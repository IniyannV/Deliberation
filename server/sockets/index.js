import { db } from '../db.js';
import { ROLES, parseCookies, roleOf, userForToken } from '../auth.js';
import { SESSION_COOKIE } from '../config.js';
import { listVotes, listVotesForDisplay, votedIn } from '../services/voting.js';
import { deliberationHandlers } from './deliberation.js';

/*
 * Socket auth: the session cookie is checked on connect AND again before
 * every event, so a logout, PIN reset or foreperson change takes effect
 * immediately. Each event declares the role groups allowed to send it;
 * anything not in the table is ignored.
 */

const presence = new Map(); // userId → connection count

export function getPresence() {
  return db.data.users
    .filter((u) => u.kind === 'juror')
    .sort((a, b) => a.seat - b.seat)
    .map((u) => ({ seat: u.seat, online: (presence.get(u.id) ?? 0) > 0, active: u.active !== false }));
}

function syncPayload(user, role) {
  const base = { display: db.data.display, counts: db.data.case.counts };
  if (ROLES.JUROR.includes(role)) {
    return {
      ...base,
      burden: db.data.case.burden ?? '',
      timeline: db.data.timeline,
      links: db.data.transcriptLinks,
      notes: db.data.imageNotes,
      personal: db.data.personal[user.id] ?? { highlights: {}, checks: {} },
      votes: listVotes(),
      votedIn: votedIn(user.id),
    };
  }
  if (role === 'display') return { ...base, timeline: db.data.timeline, votes: listVotesForDisplay() };
  if (role === 'bailiff') return { presence: getPresence() };
  return {};
}

export function registerSockets(io) {
  io.use((socket, next) => {
    const token = parseCookies(socket.handshake.headers.cookie)[SESSION_COOKIE];
    const user = userForToken(token);
    if (!user) return next(new Error('unauthorized'));
    socket.data.token = token;
    next();
  });

  io.on('connection', (socket) => {
    const user = userForToken(socket.data.token);
    const role = roleOf(user);
    socket.join(`user:${user.id}`);
    if (ROLES.JUROR.includes(role)) socket.join('jurors');
    if (role === 'bailiff') socket.join('bailiffs');
    if (role === 'display') socket.join('display');

    if (user.kind === 'juror') {
      presence.set(user.id, (presence.get(user.id) ?? 0) + 1);
      io.to('bailiffs').emit('presence', getPresence());
    }

    socket.emit('state:sync', { role, ...syncPayload(user, role) });

    for (const [event, { roles, handler }] of Object.entries(deliberationHandlers)) {
      const allowed = new Set(roles.flat());
      socket.on(event, async (payload, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        const current = userForToken(socket.data.token);
        const currentRole = roleOf(current);
        if (!current) {
          reply({ error: 'Your session has ended. Please sign in again.' });
          return socket.disconnect(true);
        }
        if (!allowed.has(currentRole)) return reply({ error: 'Not permitted for your role' });
        try {
          const result = await handler({ user: current, role: currentRole, io, socket }, payload ?? {});
          reply({ ok: true, ...(result ?? {}) });
        } catch (err) {
          reply({ error: err.expose ? err.message : 'Something went wrong' });
          if (!err.expose) console.error(`[socket] ${event}`, err);
        }
      });
    }

    socket.on('disconnect', () => {
      if (user.kind !== 'juror') return;
      presence.set(user.id, Math.max(0, (presence.get(user.id) ?? 1) - 1));
      io.to('bailiffs').emit('presence', getPresence());
    });
  });
}
