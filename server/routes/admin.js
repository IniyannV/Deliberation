import { Router } from 'express';
import { db, save } from '../db.js';
import { ROLES, destroyUserSessions, hashPin, randomPin, requireRole } from '../auth.js';
import { auditAs, readAudit, toCsv, verifyChain } from '../services/audit.js';
import { emit, disconnectUser } from '../realtime.js';
import { getPresence } from '../sockets/index.js';
import { HttpError, bad, newId, nowIso, oneOf, optStr, str } from '../lib/util.js';
import { REQUEST_STATUSES, canAdvance, publicRequest } from '../lib/requests.js';

const router = Router();
router.use(requireRole(ROLES.BAILIFF));

/* ── Overview ─────────────────────────────────────────────────────── */

router.get('/overview', (_req, res) => {
  res.json({
    case: db.data.case,
    pendingRequests: db.data.requests.filter((r) => r.status !== 'fulfilled').length,
    exhibits: db.data.exhibits.length,
    unreadUpdates: db.data.updates.filter((u) => !u.readAt).length,
    presence: getPresence(),
  });
});

/* ── Seats ────────────────────────────────────────────────────────── */

const seatView = (u) => ({ id: u.id, seat: u.seat, isForeperson: !!u.isForeperson, active: u.active !== false });

const findSeat = (id) => {
  const u = db.data.users.find((x) => x.id === id && x.kind === 'juror');
  if (!u) throw new HttpError(404, 'Seat not found');
  return u;
};

router.get('/seats', (_req, res) => {
  res.json({ seats: db.data.users.filter((u) => u.kind === 'juror').sort((a, b) => a.seat - b.seat).map(seatView) });
});

router.patch('/seats/:id', async (req, res) => {
  const u = findSeat(req.params.id);
  const { isForeperson, active } = req.body ?? {};
  if (isForeperson === true) {
    // Exactly one foreperson: reassigning clears the previous one.
    for (const other of db.data.users) if (other.kind === 'juror' && other.isForeperson && other.id !== u.id) {
      other.isForeperson = false;
      disconnectUser(other.id); // reconnects with juror powers only
    }
    u.isForeperson = true;
    auditAs(req.user, req.role, 'seat.foreperson_set', u.id, { seat: u.seat, isForeperson: true });
  }
  if (typeof active === 'boolean' && active !== (u.active !== false)) {
    u.active = active;
    if (!active) {
      u.isForeperson = false;
      await destroyUserSessions(u.id);
    }
    auditAs(req.user, req.role, 'seat.active_set', u.id, { seat: u.seat, active });
  }
  await save();
  disconnectUser(u.id);
  res.json({ seat: seatView(u) });
});

router.post('/seats/:id/reset-pin', async (req, res) => {
  const u = findSeat(req.params.id);
  const pin = randomPin();
  Object.assign(u, hashPin(pin));
  await destroyUserSessions(u.id);
  disconnectUser(u.id);
  await save();
  auditAs(req.user, req.role, 'seat.pin_reset', u.id, { seat: u.seat });
  res.json({ seat: seatView(u), pin }); // shown once to the clerk, never stored in plain text
});

/* ── Menu & supplies ──────────────────────────────────────────────── */

router.get('/catalog', (_req, res) => res.json({ menu: db.data.menu, supplies: db.data.supplies }));

function readCatalog(list, withCategory) {
  if (!Array.isArray(list) || list.length > 60) throw bad('Invalid list');
  return list.map((item) => ({
    id: typeof item.id === 'string' && item.id ? item.id.slice(0, 40) : newId(withCategory ? 'menu' : 'sup'),
    name: str(item.name, { min: 1, max: 80, field: 'Name' }),
    ...(withCategory ? {
      category: optStr(item.category, { max: 40, field: 'Category' }) || 'Main',
      dietary: optStr(item.dietary, { max: 60, field: 'Dietary notes' }),
    } : {}),
    available: item.available !== false,
  }));
}

router.put('/catalog', async (req, res) => {
  const { menu, supplies } = req.body ?? {};
  if (menu) db.data.menu = readCatalog(menu, true);
  if (supplies) db.data.supplies = readCatalog(supplies, false);
  await save();
  auditAs(req.user, req.role, 'catalog.updated', null, { itemCount: db.data.menu.length + db.data.supplies.length });
  emit('jurors', 'catalog:changed', {});
  res.json({ menu: db.data.menu, supplies: db.data.supplies });
});

/* ── Request queue ────────────────────────────────────────────────── */

router.get('/requests', (_req, res) => {
  res.json({ requests: db.data.requests.map(publicRequest).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
});

router.patch('/requests/:id', async (req, res) => {
  const r = db.data.requests.find((x) => x.id === req.params.id);
  if (!r) throw new HttpError(404, 'Request not found');
  const status = oneOf(req.body?.status, REQUEST_STATUSES, 'Status');
  if (!canAdvance(r.status, status)) throw bad(`Cannot move a ${r.status} request to ${status}`);
  const from = r.status;
  r.status = status;
  r.history.push({ status, at: nowIso(), by: req.user.id });
  await save();
  auditAs(req.user, req.role, 'request.status', r.id, { requestType: r.type, fromStatus: from, status, seat: r.seat });
  emit(['bailiffs', `user:${r.seatId}`], 'request:updated', publicRequest(r));
  res.json({ request: publicRequest(r) });
});

/* ── Family updates (bailiff → one seat, text only) ───────────────── */

router.get('/updates', (_req, res) => {
  const seatOf = (id) => db.data.users.find((u) => u.id === id)?.seat;
  res.json({
    updates: db.data.updates
      .map((u) => ({ ...u, seat: seatOf(u.seatId) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });
});

router.post('/updates', async (req, res) => {
  const seat = findSeat(req.body?.seatId);
  // Plain text only: strip control characters, keep line breaks. Rendered as text, never HTML.
  const body = str(String(req.body?.body ?? '').replace(/[^\P{C}\n]/gu, ''), { min: 1, max: 2000, field: 'Message' });
  const update = { id: newId('upd'), seatId: seat.id, body, bailiffId: req.user.id, createdAt: nowIso(), readAt: null };
  db.data.updates.push(update);
  await save();
  auditAs(req.user, req.role, 'update.sent', update.id, { seat: seat.seat });
  emit(`user:${seat.id}`, 'update:new', { id: update.id, body, createdAt: update.createdAt, readAt: null });
  res.status(201).json({ update: { ...update, seat: seat.seat } });
});

/* ── Audit log ────────────────────────────────────────────────────── */

router.get('/audit', (req, res) => {
  const all = readAudit();
  const action = req.query.action ? String(req.query.action) : '';
  const filtered = action ? all.filter((e) => e.action.startsWith(action)) : all;
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  res.json({ entries: filtered.slice(-limit).reverse(), total: filtered.length, chain: verifyChain(all) });
});

router.get('/audit.csv', (req, res) => {
  auditAs(req.user, req.role, 'audit.exported');
  const stamp = nowIso().replace(/[:.]/g, '-');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="audit-log-${stamp}.csv"`);
  res.send(toCsv(readAudit()));
});

export default router;
