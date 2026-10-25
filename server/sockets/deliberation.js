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
const DISPLAY_VIEWS = ['timeline', 'votes', 'idle', 'blackout', 'evidence', 'message'];

// Note pins are stored as fractions of the image, so they stay put at any zoom.
const noteCoord = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1) throw bad('Position is invalid');
  return Math.round(n * 10000) / 10000;
};

// One juror's own highlights, checklist ticks, private timeline and notebook. Like notes, never logged.
const personalFor = (userId) => {
  const mine = (db.data.personal[userId] ??= { highlights: {}, checks: {} });
  mine.timeline ??= [];
  mine.notebook ??= [];
  return mine;
};

const MAX_PAGES = 200;
const MAX_PAGE_HTML = 200_000;

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

/*
 * The foreperson has the final say on the shared timeline: when any other
 * juror adds, edits, moves or deletes a shared event, it waits here as a
 * proposal until the foreperson approves or declines it.
 */
const needsApproval = (p, role) => p?.scope !== 'personal' && role !== 'foreperson';

// Enough for the juror's own device to say what was decided.
const decided = ({ id, action = 'create', label, at, was }) => ({ id, action, label, at, was });

const proposalsChanged = (io) => io.to('forepersons').emit('timeline:proposals:changed', db.data.timelineProposals);

async function propose(io, user, fields) {
  db.data.timelineProposals ??= [];
  // A juror's newer change to the same event replaces their earlier one that's still waiting.
  const prior = fields.eventId
    ? db.data.timelineProposals.findIndex((x) => x.seatId === user.id && x.eventId === fields.eventId && x.action === fields.action)
    : -1;
  if (prior === -1 && db.data.timelineProposals.length >= 200) throw bad('There are too many pending proposals. Please wait for the foreperson to review them.');
  const proposal = { id: newId('prop'), ...fields, seat: user.seat, seatId: user.id, createdAt: nowIso() };
  if (prior === -1) db.data.timelineProposals.push(proposal);
  else db.data.timelineProposals[prior] = proposal;
  await save();
  proposalsChanged(io);
  io.to('forepersons').emit('timeline:proposal:new', proposal);
  return { proposed: true, proposal };
}

/** Changes still waiting for an event that's gone have nothing left to change. */
function dropProposalsFor(eventId) {
  db.data.timelineProposals = (db.data.timelineProposals ?? []).filter((x) => x.eventId !== eventId);
}

/** Apply an approved proposal to the shared timeline. Proposals saved before edits existed are all adds. */
function applyProposal(prop) {
  const action = prop.action ?? 'create';
  if (action === 'create') {
    if (db.data.timeline.length >= 2000) throw bad('The shared timeline is full');
    const { label, at, type, description, attachments } = prop;
    const ev = { id: newId('ev'), label, at, type, description, attachments, version: 1, updatedAt: nowIso() };
    db.data.timeline.push(ev);
    return ev;
  }
  const ev = db.data.timeline.find((e) => e.id === prop.eventId);
  if (!ev) return null; // removed since: nothing left to change
  if (action === 'delete') {
    db.data.timeline = db.data.timeline.filter((e) => e.id !== ev.id);
    dropProposalsFor(ev.id);
    return null;
  }
  const changes = action === 'move'
    ? { at: prop.at }
    : { label: prop.label, at: prop.at, type: prop.type, description: prop.description, attachments: prop.attachments };
  return Object.assign(ev, changes, { version: ev.version + 1, updatedAt: nowIso() });
}

async function votesChanged(io, vote) {
  io.to('jurors').emit('vote:changed', publicVote(vote));
  io.to('display').emit('vote:changed', displayVote(vote));
}

export const deliberationHandlers = {
  /* ── Timeline (shared, or the juror's personal one) ── */
  'timeline:create': {
    roles: [ROLES.JUROR],
    async handler({ io, user, role }, p) {
      if (needsApproval(p, role)) return propose(io, user, { action: 'create', ...readEvent(p) });
      const tl = timelineFor(p, user);
      if (tl.list().length >= 2000) throw bad('This timeline is full');
      const ev = { id: newId('ev'), ...readEvent(p), version: 1, updatedAt: nowIso() };
      tl.list().push(ev);
      await tl.changed(io);
      return { event: ev };
    },
  },
  'timeline:proposal:approve': {
    roles: [ROLES.FOREPERSON],
    async handler({ io }, p) {
      db.data.timelineProposals ??= [];
      const prop = db.data.timelineProposals.find((x) => x.id === p.id);
      if (!prop) throw bad('That proposal was already reviewed');
      const ev = applyProposal(prop);
      db.data.timelineProposals = db.data.timelineProposals.filter((x) => x.id !== prop.id);
      await save();

      toJurorsAndDisplay(io, 'timeline:changed', db.data.timeline);
      proposalsChanged(io);
      io.to(`user:${prop.seatId}`).emit('timeline:proposal:approved', decided(prop));
      return { event: ev };
    },
  },
  'timeline:proposal:reject': {
    roles: [ROLES.FOREPERSON],
    async handler({ io }, p) {
      db.data.timelineProposals ??= [];
      const prop = db.data.timelineProposals.find((x) => x.id === p.id);
      if (!prop) throw bad('That proposal was already reviewed');
      db.data.timelineProposals = db.data.timelineProposals.filter((x) => x.id !== prop.id);
      await save();

      proposalsChanged(io);
      io.to(`user:${prop.seatId}`).emit('timeline:proposal:rejected', decided(prop));
      return { ok: true };
    },
  },
  'timeline:update': {
    roles: [ROLES.JUROR],
    async handler({ io, socket, user, role }, p) {
      const tl = timelineFor(p, user);
      try {
        const ev = findEvent(tl.list(), p.id, p.version);
        if (needsApproval(p, role)) return propose(io, user, { action: 'update', eventId: ev.id, ...readEvent(p), was: { label: ev.label, at: ev.at } });
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
    async handler({ io, socket, user, role }, p) {
      const tl = timelineFor(p, user);
      try {
        const ev = findEvent(tl.list(), p.id, p.version);
        if (needsApproval(p, role)) {
          return propose(io, user, { action: 'move', eventId: ev.id, label: ev.label, type: ev.type, at: isoDateTime(p.at), was: { at: ev.at } });
        }
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
    async handler({ io, user, role }, p) {
      const tl = timelineFor(p, user);
      const ev = findEvent(tl.list(), p.id);
      if (needsApproval(p, role)) return propose(io, user, { action: 'delete', eventId: ev.id, label: ev.label, type: ev.type, at: ev.at });
      tl.set(tl.list().filter((e) => e.id !== p.id));
      if (p?.scope !== 'personal') dropProposalsFor(ev.id);
      await tl.changed(io);
      if (p?.scope !== 'personal') proposalsChanged(io);
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

  /* ── Notebook (one juror's own pages of formatted notes, synced across their devices) ── */
  'notebook:save': {
    roles: [ROLES.JUROR],
    async handler({ io, user }, p) {
      const mine = personalFor(user.id);
      const title = optStr(p.title, { max: 120, field: 'Title' }) || '';
      // Formatted text from the juror's own editor. Only their devices receive it,
      // and the client sanitizes it before display; here it's just bounded.
      const html = typeof p.html === 'string' ? p.html : '';
      if (html.length > MAX_PAGE_HTML) throw bad('This note is too long. Start a new one.');
      let page = p.id ? mine.notebook.find((n) => n.id === p.id) : null;
      if (!page) {
        if (mine.notebook.length >= MAX_PAGES) throw bad('Your notebook is full');
        page = { id: newId('pg'), createdAt: nowIso(), version: 0 };
        mine.notebook.unshift(page);
      }
      Object.assign(page, { title, html, version: page.version + 1, updatedAt: nowIso() });
      await save();
      io.to(`user:${user.id}`).emit('personal:changed', mine);
      return { page };
    },
  },
  'notebook:delete': {
    roles: [ROLES.JUROR],
    async handler({ io, user }, p) {
      const mine = personalFor(user.id);
      mine.notebook = mine.notebook.filter((n) => n.id !== p.id);
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
  // Sent many times a second while the foreperson scrolls, so it isn't saved to disk.
  'display:pan': {
    roles: [ROLES.FOREPERSON],
    handler({ socket }, p) {
      const pos = Number(p.pos);
      if (!Number.isFinite(pos) || pos < 0 || pos > 1) throw bad('Position is invalid');
      const playing = p.playing === true;
      pan = {
        zoom: oneOf(p.zoom ?? pan.zoom, PAN_ZOOMS, 'Zoom'),
        pos,
        playing,
        duration: playing ? int(p.duration, { min: 1000, max: 6 * 3600_000, field: 'Duration' }) : 0,
        startedAt: Date.now(),
      };
      // Not back to the sender, whose screen already shows it.
      socket.to(['jurors', 'display']).emit('display:pan', panPayload());
    },
  },
};

/*
 * Where the room display's timeline is scrolled to: a fraction of the way
 * along, so it lines up on screens of any width. While playing it glides
 * from `pos` to the end over `duration` ms; each screen works out where it
 * is from `elapsed`, so the server never sends a stream of positions.
 */
const PAN_ZOOMS = ['fit', 'spread'];
let pan = { zoom: 'fit', pos: 0, playing: false, duration: 0, startedAt: Date.now() };

export function panPayload() {
  const { startedAt, ...rest } = pan;
  return { ...rest, elapsed: pan.playing ? Date.now() - startedAt : 0 };
}

// Stop where it is, so it doesn't run on unseen while the display shows something else.
function freezePan() {
  if (!pan.playing) return false;
  pan = { ...pan, pos: Math.min(1, pan.pos + (Date.now() - pan.startedAt) / pan.duration), playing: false, duration: 0 };
  return true;
}

// An announcement for the room display, with an optional countdown (up to 12 hours away).
function readMessage(m) {
  if (m === null) return null;
  const text = str(m?.text, { min: 1, max: 160, field: 'Message' });
  if (!m.endsAt) return { text, endsAt: null };
  const endsAt = isoDateTime(m.endsAt, 'Countdown');
  const ahead = new Date(endsAt).getTime() - Date.now();
  if (ahead <= 0 || ahead > 12 * 3600_000) throw bad('Countdown must end within the next 12 hours');
  return { text, endsAt };
}

async function setDisplay(io, p) {
  const view = oneOf(p.view, DISPLAY_VIEWS, 'View');
  const prevVoteId = db.data.display?.voteId ?? null;
  const prevExhibitId = db.data.display?.exhibitId ?? null;
  const candidateVoteId = p.voteId !== undefined ? p.voteId : prevVoteId;
  const candidateExhibitId = p.exhibitId !== undefined ? p.exhibitId : prevExhibitId;
  const voteId = candidateVoteId && db.data.votes.some((v) => v.id === candidateVoteId) ? candidateVoteId : null;
  const exhibitId = candidateExhibitId && db.data.exhibits.some((e) => e.id === candidateExhibitId) ? candidateExhibitId : null;
  const message = p.message !== undefined ? readMessage(p.message) : (db.data.display?.message ?? null);
  if (view === 'message' && !message) throw bad('Write a message to show');
  db.data.display = { view, voteId, exhibitId, message };
  await save();
  toJurorsAndDisplay(io, 'display:changed', db.data.display);
  if (view !== 'timeline' && freezePan()) toJurorsAndDisplay(io, 'display:pan', panPayload());
}
