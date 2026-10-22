import { db, save } from '../db.js';
import { HttpError, bad, newId, nowIso } from '../lib/util.js';

/*
 * ── Ballot & poll anonymity ─────────────────────────────────────────
 * The server has to answer two questions: "has seat N already voted?"
 * (to stop double voting) and "how many votes did each option get?" (to
 * report a result). It must never be able to answer "how did seat N vote?".
 *
 * So each open vote keeps two structures that are never linked:
 *   voted: a Set of seat IDs. It records THAT a seat voted, never WHAT.
 *   tally: a { optionId: count } counter. It records WHAT was chosen,
 *          never by WHOM.
 * Casting a vote is one synchronous step (check `voted`, add the seat,
 * bump one counter). No vote object, per-vote timestamp or log line is
 * ever created that could join the two.
 *
 * Both structures live only in memory while the vote is open. Writing a
 * running tally to disk would let anyone with file access diff successive
 * writes and match a counter change to the seat that just joined `voted`.
 * Running totals are never broadcast either. Clients only see
 * "votesCast of eligible". If the server restarts mid-vote, that in-memory
 * state is gone, so the vote is marked "voided" and must be re-run.
 *
 * ── How the jury is divided never reaches the disk ──────────────────
 * Courts don't want the judge or staff to learn the jury's numerical split
 * (say, 11–1), and db.json sits on a laptop the clerk controls. So when a
 * vote closes, its counts move to `results`, which is also memory-only:
 * jurors see them until the server stops. db.json keeps just the vote's
 * metadata, plus, for a secret ballot, its `outcome`: 'guilty' or
 * 'not_guilty' when unanimous, otherwise 'not_unanimous', with no counts.
 *
 * Voting activity is deliberately absent from the audit log too.
 */

/** @type {Map<string, { voted: Set<string>, tally: Record<string, number> }>} */
const live = new Map();

/** Counts of closed votes, for this server run only. @type {Map<string, Record<string, number>>} */
const results = new Map();

const activeJurors = () => db.data.users.filter((u) => u.kind === 'juror' && u.active !== false);

// A ballot closes only once every eligible seat has voted, so unanimity is all-or-nothing.
function outcomeOf(tally, votesCast) {
  if (tally.guilty === votesCast) return 'guilty';
  if (tally.not_guilty === votesCast) return 'not_guilty';
  return 'not_unanimous';
}

/**
 * Called once at startup. Votes left open by a previous process can't be
 * completed. Counts written to disk by older versions are moved into memory
 * (so this run can still show them) and removed from db.json.
 */
export async function loadVotes() {
  let changed = false;
  for (const v of db.data.votes) {
    if (v.status === 'open') {
      Object.assign(v, { status: 'voided', closedAt: nowIso(), voidReason: 'server_restart' });
      changed = true;
    }
    if (v.tally) {
      results.set(v.id, v.tally);
      if (v.kind === 'ballot' && v.status === 'revealed') v.outcome = outcomeOf(v.tally, v.votesCast);
      delete v.tally;
      changed = true;
    }
  }
  if (changed) await save();
}

export function publicVote(v) {
  return {
    id: v.id,
    kind: v.kind,
    question: v.question,
    countId: v.countId ?? null,
    options: v.options,
    status: v.status,
    openedAt: v.openedAt,
    closedAt: v.closedAt ?? null,
    eligible: v.eligible,
    votesCast: v.votesCast,
    // A tally exists only after the vote closes; there is no partial tally to leak.
    // After a restart it is gone (see the comment at the top).
    tally: v.status === 'open' ? null : results.get(v.id) ?? null,
    outcome: v.outcome ?? null,
    voidReason: v.voidReason ?? null,
  };
}

export const listVotes = () => db.data.votes.map(publicVote);

/**
 * The room display never shows how many jurors have cast a secret ballot,
 * so nobody in the room can watch who is still holding out. The server
 * strips the count rather than relying on the display UI to hide it.
 */
export function displayVote(v) {
  const pub = publicVote(v);
  return pub.kind === 'ballot' && pub.status === 'open' ? { ...pub, votesCast: null } : pub;
}

export const listVotesForDisplay = () => db.data.votes.map(displayVote);

export const votedIn = (seatId) => [...live.entries()].filter(([, s]) => s.voted.has(seatId)).map(([id]) => id);

export async function openPoll({ question, options }) {
  if (db.data.votes.some((v) => v.kind === 'poll' && v.status === 'open')) throw bad('Close the current poll first');
  return open({ kind: 'poll', question, options });
}

export async function openBallot({ countId }) {
  const count = db.data.case.counts.find((c) => c.id === countId);
  if (!count) throw bad('Unknown count');
  if (db.data.votes.some((v) => v.kind === 'ballot' && v.status === 'open')) throw bad('A ballot is already open');
  const options = [{ id: 'guilty', label: 'Guilty' }, { id: 'not_guilty', label: 'Not Guilty' }];
  return open({ kind: 'ballot', question: count.label, countId, options });
}

async function open({ kind, question, options, countId }) {
  const eligible = activeJurors().length;
  if (!eligible) throw bad('No active juror seats');
  const vote = { id: newId(kind), kind, question, countId, options, status: 'open', openedAt: nowIso(), eligible, votesCast: 0 };
  db.data.votes.push(vote);
  live.set(vote.id, { voted: new Set(), tally: Object.fromEntries(options.map((o) => [o.id, 0])) });
  await save();
  return vote;
}

/** Returns the vote record; `closed` is true if this vote completed it. */
export async function castVote(voteId, seatId, optionId) {
  const vote = db.data.votes.find((v) => v.id === voteId);
  const state = live.get(voteId);
  if (!vote || vote.status !== 'open' || !state) throw bad('This vote is not open');
  if (!(optionId in state.tally)) throw bad('Unknown option');
  if (state.voted.has(seatId)) throw new HttpError(409, 'You have already voted');

  // ── the whole vote, in one synchronous step ──
  state.voted.add(seatId);
  state.tally[optionId] += 1;
  vote.votesCast = state.voted.size;
  // ─────────────────────────────────────────────

  if (vote.votesCast >= vote.eligible) {
    await close(vote, vote.kind === 'ballot' ? 'revealed' : 'closed');
    return { vote, closed: true };
  }
  return { vote, closed: false };
}

/** Foreperson ends a poll early; its results are shown. */
export async function closePoll(voteId) {
  const vote = db.data.votes.find((v) => v.id === voteId && v.kind === 'poll');
  if (!vote || vote.status !== 'open') throw bad('This poll is not open');
  await close(vote, 'closed');
  return vote;
}

/** Ballots can't be revealed early, only voided (no result is kept). */
export async function voidBallot(voteId) {
  const vote = db.data.votes.find((v) => v.id === voteId && v.kind === 'ballot');
  if (!vote || vote.status !== 'open') throw bad('This ballot is not open');
  live.delete(vote.id);
  Object.assign(vote, { status: 'voided', closedAt: nowIso(), voidReason: 'foreperson' });
  await save();
  return vote;
}

/** The jury changed (a seat excused or an alternate seated): open votes can't be finished fairly. */
export async function voidOpenVotes(reason) {
  const voided = [];
  for (const v of db.data.votes) {
    if (v.status !== 'open') continue;
    live.delete(v.id);
    Object.assign(v, { status: 'voided', closedAt: nowIso(), voidReason: reason });
    voided.push(v);
  }
  if (voided.length) await save();
  return voided;
}

/** Restarting deliberations or erasing the trial's data: every vote and count goes. */
export function clearVotes() {
  live.clear();
  results.clear();
  db.data.votes = [];
}

async function close(vote, status) {
  const state = live.get(vote.id);
  live.delete(vote.id); // discards the `voted` set
  results.set(vote.id, { ...state.tally });
  Object.assign(vote, { status, closedAt: nowIso() });
  if (vote.kind === 'ballot') vote.outcome = outcomeOf(state.tally, vote.votesCast);
  await save();
}
