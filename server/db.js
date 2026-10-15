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
  timeline: [],
  votes: [], // polls and ballots: metadata + final tallies only (see services/voting.js)
  requests: [],
  menu: [],
  supplies: [],
  updates: [],
  display: { view: 'timeline', voteId: null },
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
  await db.write();
  return db;
}

export const save = () => db.write();
