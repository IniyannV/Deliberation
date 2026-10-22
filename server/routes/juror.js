import { Router } from 'express';
import { db, save } from '../db.js';
import { ROLES, requireRole } from '../auth.js';
import { auditAs } from '../services/audit.js';
import { listVotes } from '../services/voting.js';
import { emit } from '../realtime.js';
import { HttpError, bad, int, newId, nowIso, oneOf, optStr, str } from '../lib/util.js';
import {
  JURY_TYPES, addChatMessage, addRequestMessage, publicChat, publicRequest, requestRooms, seatedSince,
} from '../lib/requests.js';

/*
 * Juror-facing REST routes: bailiff requests and chat, and closed vote history.
 */

const router = Router();
const juror = requireRole(ROLES.JUROR);

/* ── Bailiff requests ─────────────────────────────────────────────── */

router.get('/requests/options', juror, (_req, res) => {
  res.json({ menu: db.data.menu.filter((m) => m.available !== false), supplies: db.data.supplies });
});

// A juror's own requests since they took the seat, plus the jury's notes to the court.
router.get('/requests', juror, (req, res) => {
  const since = seatedSince(req.user);
  const visible = db.data.requests
    .filter((r) => JURY_TYPES.includes(r.type) || (r.seatId === req.user.id && r.createdAt >= since))
    .map(publicRequest);
  res.json({ requests: visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
});

function readItems(rawItems, catalog, field) {
  if (!Array.isArray(rawItems) || !rawItems.length || rawItems.length > 20) throw bad(`Choose at least one ${field}`);
  return rawItems.map((it) => {
    const entry = catalog.find((c) => c.id === it?.id && c.available !== false);
    if (!entry) throw bad(`Unknown ${field}`);
    return { id: entry.id, name: entry.name, qty: int(it.qty ?? 1, { min: 1, max: 5, field: 'Quantity' }) };
  });
}

router.post('/requests', juror, async (req, res) => {
  const body = req.body ?? {};
  const type = oneOf(body.type, ['break', 'meal', 'supplies', 'judge_question', 'verdict'], 'Request type');
  let payload;
  if (type === 'break') payload = { minutes: oneOf(Number(body.minutes), [5, 10, 15, 30], 'Break length') };
  if (type === 'meal') payload = { items: readItems(body.items, db.data.menu, 'menu item'), note: optStr(body.note, { max: 200, field: 'Note' }) };
  if (type === 'supplies') payload = { items: readItems(body.items, db.data.supplies, 'supply'), note: optStr(body.note, { max: 200, field: 'Note' }) };
  if (type === 'judge_question') {
    // Enforced here, not just hidden in the UI.
    if (req.role !== 'foreperson') throw new HttpError(403, 'Only the foreperson can send a question to the judge');
    payload = { text: str(body.text, { min: 5, max: 2000, field: 'Question' }) };
  }
  if (type === 'verdict') {
    // Only that a verdict has been reached. The verdict itself stays on the signed form.
    if (req.role !== 'foreperson') throw new HttpError(403, 'Only the foreperson can tell the court the jury has reached a verdict');
    if (db.data.requests.some((r) => r.type === 'verdict' && r.status !== 'fulfilled')) throw bad('The court has already been told and is on its way');
    payload = {};
  }
  const request = {
    id: newId('rq'),
    seatId: req.user.id,
    seat: req.user.seat,
    type,
    payload,
    status: 'pending',
    createdAt: nowIso(),
    history: [{ status: 'pending', at: nowIso(), by: req.user.id }],
  };
  db.data.requests.push(request);
  await save();
  auditAs(req.user, req.role, 'request.created', request.id, {
    requestType: type, seat: req.user.seat, minutes: payload.minutes, itemCount: payload.items?.length,
  });
  emit('bailiffs', 'request:new', publicRequest(request));
  emit(requestRooms(request).filter((room) => room !== 'bailiffs'), 'request:updated', publicRequest(request));
  res.status(201).json({ request: publicRequest(request) });
});

router.post('/requests/:id/messages', juror, async (req, res) => {
  const r = db.data.requests.find((x) => x.id === req.params.id && x.seatId === req.user.id && x.createdAt >= seatedSince(req.user));
  if (!r) throw new HttpError(404, 'Request not found');
  res.status(201).json({ request: await addRequestMessage(r, req.user, req.role, req.body?.text) });
});

/* ── Chat with the bailiff ─────────────────────────────────────────── */

router.get('/chat', juror, (req, res) => {
  res.json({ chat: publicChat(req.user, seatedSince(req.user)) });
});

router.post('/chat', juror, async (req, res) => {
  res.status(201).json({ chat: await addChatMessage(req.user, req.user, req.role, req.body?.text) });
});

/* ── Vote history (tallies + timestamps only) ─────────────────────── */

router.get('/history', requireRole(ROLES.JUROR, ROLES.DISPLAY), (_req, res) => {
  res.json({ votes: listVotes().filter((v) => v.status !== 'open'), counts: db.data.case.counts });
});

export default router;
