import fs from 'node:fs';
import { JSONFilePreset } from 'lowdb/node';
import { DATA_DIR, DB_FILE, UPLOAD_DIR } from './config.js';

export const defaultData = () => ({
  users: [], // court office accounts: { id, username, name, role: 'admin' | 'clerk', passHash, passSalt, active }
  sessions: [],
  cases: [], // see lib/cases.js for the shape
  exhibits: [], // every case's exhibits, each with a caseId
  menu: [], // one shared library, included in every case package
  supplies: [],
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
  await db.write();
  return db;
}

export const save = () => db.write();
