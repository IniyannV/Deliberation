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
 * "votesCast of eligible". When the vote closes, the final tally is written
 * to db.json and the `voted` set is thrown away. If the server restarts
 * mid-vote, that in-memory state is gone, so the vote is marked "voided"
 * and must be re-run.
 *
 * Voting activity is deliberately absent from the audit log too.
 */

/** @type {Map<string, { voted: Set<string>, tally: Record<string, number> }>} */
const live = new Map();

const activeJurors = () => db.data.users.filter((u) => u.kind === 'juror' && u.active !== false);

/** Called once at startup: votes left open by a previous process can't be completed. */
export async function voidStaleVotes() {
  let changed = false;
  for (const v of db.data.votes) {
    if (v.status === 'open') {
      Object.assign(v, { status: 'voided', closedAt: nowIso(), voidReason: 'server_restart' });
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
    tally: v.status === 'open' ? null : v.tally ?? null,
    voidReason: v.voidReason ?? null,
  };
}

export const listVotes = () => db.data.votes.map(publicVote);

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

async function close(vote, status) {
  const state = live.get(vote.id);
  live.delete(vote.id); // discards the `voted` set
  Object.assign(vote, { status, closedAt: nowIso(), tally: { ...state.tally } });
  await save();
}
