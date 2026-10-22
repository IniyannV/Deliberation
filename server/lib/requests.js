import { db, save } from '../db.js';
import { emit } from '../realtime.js';
import { auditAs } from '../services/audit.js';
import { newId, nowIso, str } from './util.js';

export const REQUEST_STATUSES = ['pending', 'acknowledged', 'fulfilled'];

/**
 * Notes the foreperson sends on behalf of the whole jury: questions for the
 * judge and the "we have a verdict" notice. Every juror can read these and
 * the court's answers; only the foreperson who sent one can post on its thread.
 */
export const JURY_TYPES = ['judge_question', 'verdict'];

/**
 * When an alternate takes over a seat, the seat's earlier requests and chat
 * belonged to the juror who left. Jurors see only what is
 * newer than `seatedAt`; the bailiff still sees everything.
 */
export const seatedSince = (seat) => seat.seatedAt ?? '';

/** Who hears about a change to a request: the bailiffs, plus its juror or (for jury notes) every juror. */
export const requestRooms = (r) => ['bailiffs', JURY_TYPES.includes(r.type) ? 'jurors' : `user:${r.seatId}`];

export const publicRequest = (r) => ({
  id: r.id,
  seat: r.seat,
  type: r.type,
  payload: r.payload,
  status: r.status,
  createdAt: r.createdAt,
  history: r.history,
  messages: r.messages ?? [],
  answer: r.answer ?? null, // judge questions: { mode: 'written' | 'open_court', text, at }
});

/** Requests only move forward: pending → acknowledged → fulfilled. */
export const canAdvance = (from, to) => REQUEST_STATUSES.indexOf(to) > REQUEST_STATUSES.indexOf(from);

/**
 * A short message on a request's thread, between the juror who made it and
 * the bailiff ("Kitchen is out of lentil soup, would tomato do?"). The audit
 * log records that a message was sent, never its text.
 */
export async function addRequestMessage(r, user, role, rawText) {
  const text = str(rawText, { min: 1, max: 500, field: 'Message' });
  const from = role === 'bailiff' ? 'bailiff' : 'juror';
  const message = { id: newId('msg'), from, by: user.id, text, at: nowIso() };
  (r.messages ??= []).push(message);
  await save();
  auditAs(user, role, 'request.message', r.id, { requestType: r.type, seat: r.seat });
  const pub = publicRequest(r);
  emit(requestRooms(r), 'request:updated', pub);
  emit(from === 'bailiff' ? `user:${r.seatId}` : 'bailiffs', 'request:message', { requestId: r.id, type: r.type, seat: r.seat, from });
  return pub;
}

/**
 * A standing chat between one juror and the bailiff, for anything that isn't
 * a request ("Could someone turn the heating down?"). Like request threads,
 * the audit log records that a message was sent, never its text.
 */
export const publicChat = (seat, since = '') => ({
  seatId: seat.id,
  seat: seat.seat,
  messages: (db.data.chats[seat.id] ?? []).filter((m) => m.at >= since),
});

export async function addChatMessage(seat, user, role, rawText) {
  const text = str(rawText, { min: 1, max: 500, field: 'Message' });
  const from = role === 'bailiff' ? 'bailiff' : 'juror';
  (db.data.chats[seat.id] ??= []).push({ id: newId('msg'), from, by: user.id, text, at: nowIso() });
  await save();
  auditAs(user, role, 'chat.message', seat.id, { seat: seat.seat });
  const pub = publicChat(seat);
  emit('bailiffs', 'chat:updated', pub);
  emit(`user:${seat.id}`, 'chat:updated', publicChat(seat, seatedSince(seat)));
  return role === 'bailiff' ? pub : publicChat(seat, seatedSince(seat));
}
