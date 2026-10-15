import { db, save } from '../db.js';
import { ROLES } from '../auth.js';
import { HttpError, bad, int, isoDateTime, newId, nowIso, oneOf, optStr, str } from '../lib/util.js';
import {
  castVote, closePoll, displayVote, openBallot, openPoll, publicVote, voidBallot,
} from '../services/voting.js';

/*
 * Live deliberation events: timeline, transcript links, polls, ballots and
 * the room display. None of these are written to the audit log, because
 * they are deliberation content.
 */

const EVENT_TYPES = ['testimony', 'physical', 'document'];
const DISPLAY_VIEWS = ['timeline', 'votes', 'idle'];

const toJurorsAndDisplay = (io, event, payload) => io.to(['jurors', 'display']).emit(event, payload);

function readAttachments(raw = []) {
  if (!Array.isArray(raw) || raw.length > 12) throw bad('Too many attachments');
  return raw.map((a) => {
    if (a?.kind === 'exhibit') {
      if (!db.data.exhibits.some((e) => e.id === a.exhibitId)) throw bad('Attached exhibit not found');
      return { kind: 'exhibit', exhibitId: a.exhibitId };
    }
    if (a?.kind === 'excerpt') {
      const t = db.data.exhibits.find((e) => e.id === a.transcriptId && e.type === 'transcript');
      if (!t) throw bad('Attached transcript not found');
      const max = t.lines.length;
      const fromLine = int(a.fromLine, { min: 1, max, field: 'From line' });
      const toLine = int(a.toLine ?? a.fromLine, { min: fromLine, max, field: 'To line' });
      return { kind: 'excerpt', transcriptId: t.id, fromLine, toLine };
    }
    throw bad('Unknown attachment');
  });
}

function readEvent(p) {
  return {
    at: isoDateTime(p.at, 'Date and time'),
    label: str(p.label, { min: 1, max: 120, field: 'Label' }),
    description: optStr(p.description, { max: 2000, field: 'Description' }),
    type: oneOf(p.type, EVENT_TYPES, 'Type'),
    attachments: readAttachments(p.attachments),
  };
}

function findEvent(id, version) {
  const ev = db.data.timeline.find((e) => e.id === id);
  if (!ev) throw new HttpError(404, 'That event was removed by someone else');
  if (version !== undefined && version !== ev.version) {
    throw new HttpError(409, 'Someone else just changed this event. Your view has been refreshed.');
  }
  return ev;
}

async function timelineChanged(io) {
  await save();
  toJurorsAndDisplay(io, 'timeline:changed', db.data.timeline);
}

async function votesChanged(io, vote) {
  io.to('jurors').emit('vote:changed', publicVote(vote));
  io.to('display').emit('vote:changed', displayVote(vote));
}

export const deliberationHandlers = {
  /* ── Timeline ── */
  'timeline:create': {
    roles: [ROLES.JUROR],
    async handler({ io }, p) {
      const ev = { id: newId('ev'), ...readEvent(p), version: 1, updatedAt: nowIso() };
      db.data.timeline.push(ev);
      await timelineChanged(io);
      return { event: ev };
    },
  },
  'timeline:update': {
    roles: [ROLES.JUROR],
    async handler({ io, socket }, p) {
      try {
        const ev = findEvent(p.id, p.version);
        Object.assign(ev, readEvent(p), { version: ev.version + 1, updatedAt: nowIso() });
        await timelineChanged(io);
        return { event: ev };
      } catch (err) {
        if (err.status === 409) socket.emit('timeline:changed', db.data.timeline);
        throw err;
      }
    },
  },
  'timeline:move': {
    roles: [ROLES.JUROR],
    async handler({ io, socket }, p) {
      try {
        const ev = findEvent(p.id, p.version);
        Object.assign(ev, { at: isoDateTime(p.at), version: ev.version + 1, updatedAt: nowIso() });
        await timelineChanged(io);
        return { event: ev };
      } catch (err) {
        if (err.status === 409) socket.emit('timeline:changed', db.data.timeline);
        throw err;
      }
    },
  },
  'timeline:delete': {
    roles: [ROLES.JUROR],
    async handler({ io }, p) {
      findEvent(p.id);
      db.data.timeline = db.data.timeline.filter((e) => e.id !== p.id);
      await timelineChanged(io);
    },
  },

  /* ── Transcript ↔ exhibit links ── */
  'link:create': {
    roles: [ROLES.JUROR],
    async handler({ io }, p) {
      const t = db.data.exhibits.find((e) => e.id === p.transcriptId && e.type === 'transcript');
      if (!t) throw bad('Transcript not found');
      const line = int(p.line, { min: 1, max: t.lines.length, field: 'Line' });
      if (!db.data.exhibits.some((e) => e.id === p.exhibitId && e.id !== t.id)) throw bad('Exhibit not found');
      const dupe = db.data.transcriptLinks.some((l) => l.transcriptId === t.id && l.line === line && l.exhibitId === p.exhibitId);
      if (!dupe) db.data.transcriptLinks.push({ id: newId('lnk'), transcriptId: t.id, line, exhibitId: p.exhibitId });
      await save();
      io.to('jurors').emit('links:changed', db.data.transcriptLinks);
    },
  },
  'link:delete': {
    roles: [ROLES.JUROR],
    async handler({ io }, p) {
      db.data.transcriptLinks = db.data.transcriptLinks.filter((l) => l.id !== p.id);
      await save();
      io.to('jurors').emit('links:changed', db.data.transcriptLinks);
    },
  },

  /* ── Image notes (shared with the jury, never logged) ── */
  'note:create': {
    roles: [ROLES.JUROR],
    async handler({ io }, p) {
      if (!db.data.exhibits.some((e) => e.id === p.exhibitId && e.type === 'image')) throw bad('Notes can only be added to image exhibits');
      const coord = (v, field) => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > 1) throw bad(`${field} is off the image`);
        return Math.round(n * 10000) / 10000;
      };
      const note = { id: newId('note'), exhibitId: p.exhibitId, x: coord(p.x, 'Position'), y: coord(p.y, 'Position'), text: str(p.text, { min: 1, max: 500, field: 'Note' }), createdAt: nowIso() };
      db.data.imageNotes.push(note);
      await save();
      io.to('jurors').emit('notes:changed', db.data.imageNotes);
      return { note };
    },
  },
  'note:update': {
    roles: [ROLES.JUROR],
    async handler({ io }, p) {
      const note = db.data.imageNotes.find((n) => n.id === p.id);
      if (!note) throw new HttpError(404, 'That note was removed');
      note.text = str(p.text, { min: 1, max: 500, field: 'Note' });
      await save();
      io.to('jurors').emit('notes:changed', db.data.imageNotes);
    },
  },
  'note:delete': {
    roles: [ROLES.JUROR],
    async handler({ io }, p) {
      db.data.imageNotes = db.data.imageNotes.filter((n) => n.id !== p.id);
      await save();
      io.to('jurors').emit('notes:changed', db.data.imageNotes);
    },
  },

  /* ── Polls ── */
  'poll:open': {
    roles: [ROLES.FOREPERSON],
    async handler({ io }, p) {
      const labels = Array.isArray(p.options) ? p.options : [];
      if (labels.length < 2 || labels.length > 6) throw bad('A poll needs 2 to 6 options');
      const options = labels.map((l, i) => ({ id: `opt${i + 1}`, label: str(l, { min: 1, max: 60, field: 'Option' }) }));
      const question = str(p.question || 'Where are you leaning right now?', { min: 1, max: 200, field: 'Question' });
      const vote = await openPoll({ question, options });
      if (p.showOnDisplay) await setDisplay(io, { view: 'votes', voteId: vote.id });
      await votesChanged(io, vote);
      return { vote: publicVote(vote) };
    },
  },
  'poll:close': {
    roles: [ROLES.FOREPERSON],
    async handler({ io }, p) {
      const vote = await closePoll(p.id);
      await votesChanged(io, vote);
    },
  },

  /* ── Secret ballots ── */
  'ballot:open': {
    roles: [ROLES.FOREPERSON],
    async handler({ io }, p) {
      const vote = await openBallot({ countId: p.countId });
      if (p.showOnDisplay) await setDisplay(io, { view: 'votes', voteId: vote.id });
      await votesChanged(io, vote);
      return { vote: publicVote(vote) };
    },
  },
  'ballot:void': {
    roles: [ROLES.FOREPERSON],
    async handler({ io }, p) {
      const vote = await voidBallot(p.id);
      await votesChanged(io, vote);
    },
  },

  /* ── Casting (polls and ballots) ── */
  'vote:cast': {
    roles: [ROLES.JUROR],
    async handler({ io, user }, p) {
      const { vote } = await castVote(String(p.id), user.id, String(p.optionId));
      // Only the voter's own devices learn that this seat has voted.
      io.to(`user:${user.id}`).emit('vote:recorded', { id: vote.id });
      await votesChanged(io, vote);
    },
  },

  /* ── Room display ── */
  'display:set': {
    roles: [ROLES.FOREPERSON],
    async handler({ io }, p) {
      await setDisplay(io, p);
    },
  },
};

async function setDisplay(io, p) {
  const view = oneOf(p.view, DISPLAY_VIEWS, 'View');
  const voteId = view === 'votes' && p.voteId && db.data.votes.some((v) => v.id === p.voteId) ? p.voteId : null;
  db.data.display = { view, voteId };
  await save();
  toJurorsAndDisplay(io, 'display:changed', db.data.display);
}
