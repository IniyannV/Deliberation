import { db, save } from '../db.js';
import { emit } from '../realtime.js';
import { auditAs } from '../services/audit.js';
import { newId, nowIso, str } from './util.js';

export const REQUEST_STATUSES = ['pending', 'acknowledged', 'fulfilled'];

export const publicRequest = (r) => ({
  id: r.id,
  seat: r.seat,
  type: r.type,
  payload: r.payload,
  status: r.status,
  createdAt: r.createdAt,
  history: r.history,
  messages: r.messages ?? [],
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
  emit(['bailiffs', `user:${r.seatId}`], 'request:updated', pub);
  emit(from === 'bailiff' ? `user:${r.seatId}` : 'bailiffs', 'request:message', { requestId: r.id, type: r.type, seat: r.seat, from });
  return pub;
}

/**
 * A standing chat between one juror and the bailiff, for anything that isn't
 * a request ("Could someone turn the heating down?"). Like request threads,
 * the audit log records that a message was sent, never its text.
 */
export const publicChat = (seat) => ({ seatId: seat.id, seat: seat.seat, messages: db.data.chats[seat.id] ?? [] });

export async function addChatMessage(seat, user, role, rawText) {
  const text = str(rawText, { min: 1, max: 500, field: 'Message' });
  const from = role === 'bailiff' ? 'bailiff' : 'juror';
  (db.data.chats[seat.id] ??= []).push({ id: newId('msg'), from, by: user.id, text, at: nowIso() });
  await save();
  auditAs(user, role, 'chat.message', seat.id, { seat: seat.seat });
  const pub = publicChat(seat);
  emit(['bailiffs', `user:${seat.id}`], 'chat:updated', pub);
  return pub;
}
