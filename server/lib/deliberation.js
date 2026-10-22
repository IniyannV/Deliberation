import { db } from '../db.js';
import { emit } from '../realtime.js';
import { clearVotes, displayVote, listVotes, listVotesForDisplay, publicVote } from '../services/voting.js';

/*
 * Clearing the jury's shared work, for when an alternate joins and the judge
 * tells the jury to begin deliberations anew, and at the end of a trial.
 */

/** The shared timeline, exhibit notes, transcript links and every poll and ballot. */
export function clearSharedDeliberation() {
  db.data.timeline = [];
  db.data.imageNotes = [];
  db.data.transcriptLinks = [];
  clearVotes();
}

/** Push the cleared state to every juror device and the room display. */
export function broadcastDeliberation() {
  emit(['jurors', 'display'], 'timeline:changed', db.data.timeline);
  emit('jurors', 'notes:changed', db.data.imageNotes);
  emit('jurors', 'links:changed', db.data.transcriptLinks);
  emit('jurors', 'votes:reset', { votes: listVotes() });
  emit('display', 'votes:reset', { votes: listVotesForDisplay() });
  emit(['jurors', 'display'], 'display:changed', db.data.display);
}

/** Votes voided because the jury changed: tell jurors and the display. */
export function broadcastVoided(votes) {
  for (const v of votes) {
    emit('jurors', 'vote:changed', publicVote(v));
    emit('display', 'vote:changed', displayVote(v));
  }
}

export const RESTART_MESSAGE = 'The jury has changed. As the judge instructed, please begin your deliberations again.';
