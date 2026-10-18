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
const DISPLAY_VIEWS = ['timeline', 'votes', 'idle', 'blackout', 'evidence'];

// Note pins are stored as fractions of the image, so they stay put at any zoom.
const noteCoord = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1) throw bad('Position is invalid');
  return Math.round(n * 10000) / 10000;
};

// One juror's own highlights, checklist ticks and private timeline. Like notes, never logged.
const personalFor = (userId) => {
  const mine = (db.data.personal[userId] ??= { highlights: {}, checks: {} });
  mine.timeline ??= [];
  return mine;
};

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

/*
 * Two timelines: the shared one every juror edits (and the room display
 * shows), and each juror's personal one, which only their own devices see.
 * `scope: 'personal'` on a timeline event picks the second.
 */
function timelineFor(p, user) {
  if (p?.scope === 'personal') {
    const mine = personalFor(user.id);
    return {
      list: () => mine.timeline,
      set: (next) => { mine.timeline = next; },
      async changed(io) {
        await save();
        io.to(`user:${user.id}`).emit('personal:changed', mine);
      },
      refresh: (socket) => socket.emit('personal:changed', mine),
    };
  }
  return {
    list: () => db.data.timeline,
    set: (next) => { db.data.timeline = next; },
    async changed(io) {
      await save();
      toJurorsAndDisplay(io, 'timeline:changed', db.data.timeline);
    },
    refresh: (socket) => socket.emit('timeline:changed', db.data.timeline),
  };
}

function findEvent(list, id, version) {
  const ev = list.find((e) => e.id === id);
  if (!ev) throw new HttpError(404, 'That event was removed by someone else');
  if (version !== undefined && version !== ev.version) {
    throw new HttpError(409, 'Someone else just changed this event. Your view has been refreshed.');
  }
  return ev;
}

async function votesChanged(io, vote) {
  io.to('jurors').emit('vote:changed', publicVote(vote));
  io.to('display').emit('vote:changed', displayVote(vote));
}

export const deliberationHandlers = {
  /* ── Timeline (shared, or the juror's personal one) ── */
  'timeline:create': {
    roles: [ROLES.JUROR],
    async handler({ io, user }, p) {
      const tl = timelineFor(p, user);
      if (tl.list().length >= 2000) throw bad('This timeline is full');
      const ev = { id: newId('ev'), ...readEvent(p), version: 1, updatedAt: nowIso() };
      tl.list().push(ev);
      await tl.changed(io);
      return { event: ev };
    },
  },
  'timeline:update': {
    roles: [ROLES.JUROR],
    async handler({ io, socket, user }, p) {
      const tl = timelineFor(p, user);
      try {
        const ev = findEvent(tl.list(), p.id, p.version);
        Object.assign(ev, readEvent(p), { version: ev.version + 1, updatedAt: nowIso() });
        await tl.changed(io);
        return { event: ev };
      } catch (err) {
        if (err.status === 409) tl.refresh(socket);
        throw err;
      }
    },
  },
  'timeline:move': {
    roles: [ROLES.JUROR],
    async handler({ io, socket, user }, p) {
      const tl = timelineFor(p, user);
      try {
        const ev = findEvent(tl.list(), p.id, p.version);
        Object.assign(ev, { at: isoDateTime(p.at), version: ev.version + 1, updatedAt: nowIso() });
        await tl.changed(io);
        return { event: ev };
      } catch (err) {
        if (err.status === 409) tl.refresh(socket);
        throw err;
      }
    },
  },
  'timeline:delete': {
    roles: [ROLES.JUROR],
    async handler({ io, user }, p) {
      const tl = timelineFor(p, user);
      findEvent(tl.list(), p.id);
      tl.set(tl.list().filter((e) => e.id !== p.id));
      await tl.changed(io);
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

  /* ── Exhibit notes & annotations (images and PDFs, shared with the jury, never logged) ── */
  'note:create': {
    roles: [ROLES.JUROR],
    async handler({ io }, p) {
      const exhibit = db.data.exhibits.find((e) => e.id === p.exhibitId);
      if (!exhibit || (exhibit.type !== 'image' && exhibit.type !== 'pdf')) {
        throw bad('Notes can only be added to image or PDF exhibits');
      }
      const kind = p.kind && ['note', 'highlight', 'drawing'].includes(p.kind) ? p.kind : 'note';
      const page = p.page ? int(p.page, { min: 1, max: 10000, field: 'Page' }) : 1;
      const color = p.color && typeof p.color === 'string' ? p.color.slice(0, 20) : 'yellow';

      const note = {
        id: newId('note'),
        exhibitId: p.exhibitId,
        page,
        kind,
        color,
        createdAt: nowIso(),
      };

      if (kind === 'drawing') {
        if (!Array.isArray(p.points) || p.points.length < 2) throw bad('Invalid drawing');
        note.points = p.points.slice(0, 500).map(([x, y]) => [noteCoord(x), noteCoord(y)]);
      } else {
        note.x = noteCoord(p.x);
        note.y = noteCoord(p.y);
      }

      if (kind === 'highlight') {
        note.width = noteCoord(p.width ?? 0.2);
        note.height = noteCoord(p.height ?? 0.05);
      }

      note.text = optStr(p.text, { max: 500, field: 'Note' }) || (kind === 'note' ? str(p.text, { min: 1, max: 500, field: 'Note' }) : '');
      if (p.quote) note.quote = optStr(p.quote, { max: 500, field: 'Quote' });

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
      if (p.text !== undefined) note.text = optStr(p.text, { max: 500, field: 'Note' }) || '';
      if (p.quote !== undefined) note.quote = optStr(p.quote, { max: 500, field: 'Quote' }) || '';
      if (p.color !== undefined) note.color = str(p.color, { min: 1, max: 20, field: 'Color' });
      await save();
      io.to('jurors').emit('notes:changed', db.data.imageNotes);
    },
  },
  'note:move': {
    roles: [ROLES.JUROR],
    async handler({ io }, p) {
      const note = db.data.imageNotes.find((n) => n.id === p.id);
      if (!note) throw new HttpError(404, 'That note was removed');
      if (p.x !== undefined) note.x = noteCoord(p.x);
      if (p.y !== undefined) note.y = noteCoord(p.y);
      if (p.width !== undefined) note.width = noteCoord(p.width);
      if (p.height !== undefined) note.height = noteCoord(p.height);
      if (p.page !== undefined) note.page = int(p.page, { min: 1, max: 10000, field: 'Page' });
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

  /* ── Personal marks (private to one juror, synced across their devices) ── */
  'highlight:set': {
    roles: [ROLES.JUROR],
    async handler({ io, user }, p) {
      const t = db.data.exhibits.find((e) => e.id === p.transcriptId && e.type === 'transcript');
      if (!t) throw bad('Transcript not found');
      if (!p.lines || typeof p.lines !== 'object' || Object.keys(p.lines).length > 2000) throw bad('Nothing to highlight');
      const mine = personalFor(user.id);
      const byLine = (mine.highlights[t.id] ??= {});
      for (const [key, ranges] of Object.entries(p.lines)) {
        const line = t.lines.find((l) => l.n === Number(key));
        if (!line) throw bad('Line not found');
        if (!Array.isArray(ranges) || ranges.length > 100) throw bad('Bad highlight');
        const clean = ranges.map((r) => {
          const start = int(r?.[0], { min: 0, max: line.text.length, field: 'Highlight start' });
          const end = int(r?.[1], { min: start, max: line.text.length, field: 'Highlight end' });
          return [start, end];
        }).filter(([a, b]) => b > a);
        if (clean.length) byLine[line.n] = clean;
        else delete byLine[line.n];
      }
      await save();
      io.to(`user:${user.id}`).emit('personal:changed', mine);
    },
  },
  'check:set': {
    roles: [ROLES.JUROR],
    async handler({ io, user }, p) {
      const count = db.data.case.counts.find((c) => c.id === p.countId);
      if (!count) throw bad('Count not found');
      const element = int(p.element, { min: 0, max: (count.elements?.length ?? 1) - 1, field: 'Element' });
      const mine = personalFor(user.id);

      let currentMap = {};
      const existing = mine.checks[count.id];
      if (Array.isArray(existing)) {
        existing.forEach((idx) => { currentMap[idx] = 'proven'; });
      } else if (existing && typeof existing === 'object') {
        currentMap = { ...existing };
      }

      if (p.state) {
        if (p.state === 'unproven') {
          delete currentMap[element];
        } else {
          currentMap[element] = p.state; // 'proven' | 'disputed'
        }
      } else if (p.checked != null) {
        if (p.checked) currentMap[element] = 'proven';
        else delete currentMap[element];
      }

      mine.checks[count.id] = currentMap;
      await save();
      io.to(`user:${user.id}`).emit('personal:changed', mine);
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
  const prevVoteId = db.data.display?.voteId ?? null;
  const prevExhibitId = db.data.display?.exhibitId ?? null;
  const candidateVoteId = p.voteId !== undefined ? p.voteId : prevVoteId;
  const candidateExhibitId = p.exhibitId !== undefined ? p.exhibitId : prevExhibitId;
  const voteId = candidateVoteId && db.data.votes.some((v) => v.id === candidateVoteId) ? candidateVoteId : null;
  const exhibitId = candidateExhibitId && db.data.exhibits.some((e) => e.id === candidateExhibitId) ? candidateExhibitId : null;
  db.data.display = { view, voteId, exhibitId };
  await save();
  toJurorsAndDisplay(io, 'display:changed', db.data.display);
}
