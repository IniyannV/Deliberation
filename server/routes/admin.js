import { Router } from 'express';
import { db, save } from '../db.js';
import { ROLES, destroyUserSessions, hashPin, randomPin, requireRole } from '../auth.js';
import { auditAs, readAudit, toCsv, verifyChain } from '../services/audit.js';
import { emit, disconnectRooms, disconnectUser } from '../realtime.js';
import { getPresence } from '../sockets/index.js';
import { withSummary } from '../lib/auditText.js';
import { HttpError, bad, newId, nowIso, oneOf, optStr, str } from '../lib/util.js';
import {
  REQUEST_STATUSES, addChatMessage, addRequestMessage, canAdvance, publicChat, publicRequest, requestRooms,
} from '../lib/requests.js';
import { RESTART_MESSAGE, broadcastDeliberation, broadcastVoided, clearSharedDeliberation } from '../lib/deliberation.js';
import { voidOpenVotes } from '../services/voting.js';
import { ALLOW_ONLINE_EXHIBITS } from '../config.js';

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
    onlineExhibits: ALLOW_ONLINE_EXHIBITS,
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
    // Votes count the seats that were active when they opened, so they can't finish fairly now.
    broadcastVoided(await voidOpenVotes('jury_changed'));
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

/*
 * An alternate takes over a seat. They get a new PIN and start with nothing
 * from the juror who left: no private marks, and none of that juror's
 * requests, chat or family updates (see `seatedSince`). Many courts instruct
 * a reconstituted jury to begin deliberations anew, so `restart` also clears
 * the shared timeline, exhibit notes, links and votes.
 */
router.post('/seats/:id/substitute', async (req, res) => {
  const u = findSeat(req.params.id);
  const restart = req.body?.restart !== false;
  const wasForeperson = !!u.isForeperson;
  const pin = randomPin();
  Object.assign(u, hashPin(pin), { active: true, isForeperson: false, seatedAt: nowIso() });
  delete db.data.personal[u.id];
  await destroyUserSessions(u.id);
  disconnectUser(u.id);
  const voided = await voidOpenVotes('jury_changed');
  if (restart) {
    clearSharedDeliberation();
    db.data.display = { view: 'message', voteId: null, exhibitId: null, message: { text: RESTART_MESSAGE, endsAt: null } };
  }
  await save();
  auditAs(req.user, req.role, 'seat.substituted', u.id, { seat: u.seat, restarted: restart });
  if (restart) broadcastDeliberation();
  else broadcastVoided(voided);
  res.json({ seat: seatView(u), pin, wasForeperson });
});

/* ── Deliberation controls ────────────────────────────────────────── */

// The judge tells the jury to begin again, without seating anyone new.
router.post('/deliberation/restart', async (req, res) => {
  clearSharedDeliberation();
  db.data.display = { view: 'message', voteId: null, exhibitId: null, message: { text: RESTART_MESSAGE, endsAt: null } };
  await save();
  auditAs(req.user, req.role, 'deliberation.restarted');
  broadcastDeliberation();
  res.json({ ok: true });
});

const signOutJurors = async () => {
  const seats = new Set(db.data.users.filter((u) => u.kind === 'juror' || u.kind === 'display').map((u) => u.id));
  const before = db.data.sessions.length;
  db.data.sessions = db.data.sessions.filter((s) => !seats.has(s.userId));
  await save();
  disconnectRooms(['jurors', 'display']);
  return before - db.data.sessions.length;
};

// End of the court day: every juror iPad and the room display need their PIN again tomorrow.
router.post('/sessions/sign-out-jurors', async (req, res) => {
  const signedOut = await signOutJurors();
  auditAs(req.user, req.role, 'session.jurors_signed_out', null, { signedOut });
  res.json({ signedOut });
});

/*
 * End of trial: erase what the jury wrote and decided, once the verdict is
 * in and the court says the data need not be kept. Exhibits, the case,
 * seats, judge questions and answers, and the audit log stay. The clerk
 * types the case number to confirm.
 */
router.post('/deliberation/erase', async (req, res) => {
  const expected = (db.data.case.caseNumber || 'ERASE').trim().toLowerCase();
  if (String(req.body?.confirm ?? '').trim().toLowerCase() !== expected) {
    throw bad(db.data.case.caseNumber ? 'Type the case number exactly to confirm' : 'Type ERASE to confirm');
  }
  clearSharedDeliberation();
  db.data.personal = {};
  db.data.chats = {};
  for (const r of db.data.requests) delete r.messages;
  for (const u of db.data.updates) Object.assign(u, { body: '', erased: true });
  db.data.display = { view: 'idle', voteId: null, exhibitId: null, message: null };
  const signedOut = await signOutJurors();
  auditAs(req.user, req.role, 'deliberation.erased', null, { signedOut });
  res.json({ ok: true });
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
  emit(requestRooms(r), 'request:updated', publicRequest(r));
  res.json({ request: publicRequest(r) });
});

/*
 * The court's response to a jury question: the judge's written answer, or
 * word that the answer will be given in open court. Every juror sees it.
 * The audit log records that it was answered and how, never the text.
 */
router.post('/requests/:id/answer', async (req, res) => {
  const r = db.data.requests.find((x) => x.id === req.params.id);
  if (!r) throw new HttpError(404, 'Request not found');
  if (r.type !== 'judge_question') throw bad('Only a question for the judge can be answered');
  const mode = oneOf(req.body?.mode, ['written', 'open_court'], 'Answer type');
  const text = mode === 'written'
    ? str(req.body?.text, { min: 1, max: 4000, field: 'Answer' })
    : optStr(req.body?.text, { max: 500, field: 'Note' });
  r.answer = { mode, text, at: nowIso() };
  if (r.status !== 'fulfilled') {
    r.status = 'fulfilled';
    r.history.push({ status: 'fulfilled', at: r.answer.at, by: req.user.id });
  }
  await save();
  auditAs(req.user, req.role, 'request.answered', r.id, { requestType: r.type, seat: r.seat, answerMode: mode });
  emit(requestRooms(r), 'request:updated', publicRequest(r));
  emit('jurors', 'request:answered', { requestId: r.id, mode });
  res.json({ request: publicRequest(r) });
});

router.post('/requests/:id/messages', async (req, res) => {
  const r = db.data.requests.find((x) => x.id === req.params.id);
  if (!r) throw new HttpError(404, 'Request not found');
  res.status(201).json({ request: await addRequestMessage(r, req.user, req.role, req.body?.text) });
});

/* ── Juror chats ──────────────────────────────────────────────────── */

const lastAt = (c) => c.messages.at(-1)?.at ?? '';

router.get('/chats', (_req, res) => {
  const chats = db.data.users
    .filter((u) => u.kind === 'juror' && db.data.chats[u.id]?.length)
    .map((u) => publicChat(u))
    .sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
  res.json({ chats });
});

router.post('/chats/:seatId/messages', async (req, res) => {
  const seat = db.data.users.find((u) => u.id === req.params.seatId && u.kind === 'juror');
  if (!seat) throw new HttpError(404, 'Juror seat not found');
  res.status(201).json({ chat: await addChatMessage(seat, req.user, req.role, req.body?.text) });
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
  res.json({ entries: filtered.slice(-limit).reverse().map(withSummary), total: filtered.length, chain: verifyChain(all) });
});

router.get('/audit.csv', (req, res) => {
  auditAs(req.user, req.role, 'audit.exported');
  const stamp = nowIso().replace(/[:.]/g, '-');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="audit-log-${stamp}.csv"`);
  res.send(toCsv(readAudit().map(withSummary)));
});

export default router;
