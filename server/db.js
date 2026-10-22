import fs from 'node:fs';
import { JSONFilePreset } from 'lowdb/node';
import { DATA_DIR, DB_FILE, UPLOAD_DIR } from './config.js';

export const defaultData = () => ({
  case: { caption: 'No case loaded', caseNumber: '', court: '', counts: [] },
  users: [],
  sessions: [],
  exhibits: [],
  transcriptLinks: [],
  imageNotes: [],
  personal: {}, // userId → { highlights, checks, timeline, notebook }: one juror's own marks, private timeline and notes, never shared or logged
  timeline: [],
  votes: [], // polls and ballots: metadata only, never counts (see services/voting.js)
  requests: [],
  chats: {}, // seatId → messages: open chat between one juror and the bailiff, apart from any request
  menu: [],
  supplies: [],
  display: { view: 'timeline', voteId: null, exhibitId: null, message: null },
});

/** @type {import('lowdb').Low<ReturnType<typeof defaultData>>} */
export let db;

export async function initDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  db = await JSONFilePreset(DB_FILE, defaultData());
  for (const [key, value] of Object.entries(defaultData())) {
    if (db.data[key] === undefined) db.data[key] = value;
  }
  if (db.data.display?.view === 'calm') db.data.display.view = 'idle';
  // Interactive map and chart exhibits were retired. Their uploaded files are left in place.
  const retired = new Set(db.data.exhibits.filter((e) => e.type === 'map' || e.type === 'chart').map((e) => e.id));
  if (retired.size) {
    db.data.exhibits = db.data.exhibits.filter((e) => !retired.has(e.id));
    db.data.transcriptLinks = db.data.transcriptLinks.filter((l) => !retired.has(l.exhibitId));
    for (const ev of db.data.timeline) ev.attachments = (ev.attachments ?? []).filter((a) => !retired.has(a.exhibitId));
    console.log(`  Retired ${retired.size} interactive map/chart exhibit(s); re-upload them as PDFs or images if still needed.`);
  }
  // Messages from home were retired. Drop any still stored, so their text isn't left on disk.
  if (db.data.updates) {
    delete db.data.updates;
    console.log('  Removed stored messages from home (feature retired).');
  }
  await db.write();
  return db;
}

export const save = () => db.write();
