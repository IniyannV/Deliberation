/*
 * npm run seed: creates a fictional case for demos.
 * Stop the server first; this replaces server/data/db.json.
 *
 * Seeds the Texas trial case (The State of Texas v. Cody Ray Brennan)
 * into the Jury Deliberation server (port 4000) for juror iPads.
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { DATA_DIR, DB_FILE, AUDIT_FILE, PORT, UPLOAD_DIR } from '../config.js';
import { defaultData, initDb, db } from '../db.js';
import { hashPin, randomPin } from '../auth.js';
import { audit, initAudit } from '../services/audit.js';
import { parseTranscript } from '../lib/exhibits.js';
import { newId, nowIso } from '../lib/util.js';
import { MENU, SUPPLIES } from './lib/case-content.js';
import { TEXAS_CASE, TEXAS_EXHIBITS, TEXAS_JURY, TEXAS_DEMO_PINS, renderTexasExhibit } from './lib/texas-case.js';
import { demoTimeline } from './lib/demo-timeline.js';

const FOREPERSON_SEAT = 1;

// A running server keeps the old database in memory and writes it back over
// this one, leaving every exhibit pointing at a file this script deleted.
const serverUp = await new Promise((resolve) => {
  const socket = net.connect(PORT, '127.0.0.1')
    .once('connect', () => { socket.destroy(); resolve(true); })
    .once('error', () => resolve(false));
});
if (serverUp) {
  console.error(`The server is running on port ${PORT}. Stop it first, then run the seed again.`);
  process.exit(1);
}

// Never delete the audit trail: archive the old one alongside the new.
fs.mkdirSync(DATA_DIR, { recursive: true });
if (fs.existsSync(AUDIT_FILE)) {
  const archived = AUDIT_FILE.replace('.jsonl', `.archived-${Date.now()}.jsonl`);
  fs.renameSync(AUDIT_FILE, archived);
  console.log(`Archived previous audit log → ${path.basename(archived)}`);
}
fs.rmSync(DB_FILE, { force: true });
fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });

await initDb();
initAudit();
db.data = defaultData();

const caseRecord = {
  id: 'courtcase-3',
  caption: TEXAS_CASE.caption,
  caseNumber: TEXAS_CASE.caseNumber,
  court: TEXAS_CASE.court,
  burden: TEXAS_CASE.burden,
  counts: TEXAS_CASE.counts,
};
db.data.case = caseRecord;
db.data.cases = [caseRecord];

/* ── Accounts ── */
const credentials = [];
for (let seat = 1; seat <= 12; seat++) {
  const pin = TEXAS_DEMO_PINS[seat] || randomPin();
  db.data.users.push({
    id: `${TEXAS_CASE.caseNumber}-seat-${String(seat).padStart(2, '0')}`,
    caseNumber: TEXAS_CASE.caseNumber,
    kind: 'juror',
    seat,
    isForeperson: seat === FOREPERSON_SEAT,
    active: true,
    ...hashPin(pin),
  });
  credentials.push({
    who: `Juror seat ${seat}${seat === FOREPERSON_SEAT ? ' (foreperson)' : ''}`,
    signIn: `${TEXAS_CASE.caseNumber}-${seat}`,
    pin,
  });
}

const bailiffLogin = TEXAS_JURY.bailiff?.login || 'B1';
const bailiffName = TEXAS_JURY.bailiff?.name || 'Bailiff J. Ortiz';
const bailiffPin = TEXAS_DEMO_PINS.bailiff || randomPin();
db.data.users.push({
  id: `${TEXAS_CASE.caseNumber}-bailiff-01`,
  caseNumber: TEXAS_CASE.caseNumber,
  kind: 'bailiff',
  login: bailiffLogin,
  name: bailiffName,
  active: true,
  ...hashPin(bailiffPin),
});
credentials.push({
  who: `Bailiff (${bailiffName})`,
  signIn: `${TEXAS_CASE.caseNumber}-${bailiffLogin}`,
  pin: bailiffPin,
});

const displayPin = TEXAS_DEMO_PINS.display || randomPin();
db.data.users.push({
  id: `${TEXAS_CASE.caseNumber}-display-01`,
  caseNumber: TEXAS_CASE.caseNumber,
  kind: 'display',
  login: 'DISPLAY',
  name: 'Room Display',
  active: true,
  ...hashPin(displayPin),
});
credentials.push({
  who: 'Room display (projector)',
  signIn: `${TEXAS_CASE.caseNumber}-DISPLAY`,
  pin: displayPin,
});

const bailiff = db.data.users.find((u) => u.kind === 'bailiff');
audit({ actor: 'system', role: 'system', action: 'seed.case_created', meta: { caseNumber: TEXAS_CASE.caseNumber } });

/* ── Exhibits ── */
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
for (const def of TEXAS_EXHIBITS) {
  const { buffer, ext, mime, type } = await renderTexasExhibit(def);
  const stored = `${newId('file')}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), buffer);
  const exhibit = {
    id: newId('ex'),
    caseNumber: TEXAS_CASE.caseNumber,
    number: def.number,
    title: def.title,
    party: def.party,
    dateAdmitted: def.dateAdmitted,
    description: def.description,
    type,
    file: { stored, mime, size: buffer.length, originalName: `${def.number}${ext}` },
    lines: type === 'transcript' ? parseTranscript(def.text) : undefined,
    uploadedBy: bailiff.id,
    uploadedAt: nowIso(),
  };
  db.data.exhibits.push(exhibit);
  audit({
    actor: bailiff.id,
    role: 'bailiff',
    action: 'exhibit.uploaded',
    target: exhibit.id,
    meta: { exhibitNumber: exhibit.number, exhibitType: type },
  });
}

/* ── A shared timeline already filled in, to demo ── */
db.data.timeline = demoTimeline(TEXAS_CASE.caseNumber, db.data.exhibits);

/* ── Menu and supplies ── */
db.data.menu = MENU.map((m) => ({ id: newId('menu'), ...m, available: true }));
db.data.supplies = SUPPLIES.map((name) => ({ id: newId('sup'), name, available: true }));

await db.write();

/* ── Credentials ── */
console.log(`\nSeeded "${TEXAS_CASE.caption}" (${TEXAS_CASE.caseNumber})`);
console.log(`  ${db.data.exhibits.length} exhibits · ${db.data.timeline.length} timeline events · ${db.data.menu.length} menu items\n`);
console.log('  Sign-in credentials (shown once; PINs are stored only as hashes):\n');
console.log('  ' + 'Who'.padEnd(32) + 'Sign-in ID'.padEnd(28) + 'PIN');
console.log('  ' + '─'.repeat(66));
const rows = credentials.map((c) => '  ' + c.who.padEnd(32) + c.signIn.padEnd(28) + c.pin);
for (const r of rows) console.log(r);
console.log('  ' + '─'.repeat(66));
console.log('\n  The clerk can reset any juror PIN from /admin/jurors.');

// Demo convenience: the same table, saved where the git-ignored data lives.
const credFile = path.join(DATA_DIR, 'demo-credentials.txt');
fs.writeFileSync(
  credFile,
  [
    `Demo sign-ins for "${TEXAS_CASE.caption}" (${TEXAS_CASE.caseNumber}) (generated ${nowIso()})`,
    '',
    '  ' + 'Who'.padEnd(32) + 'Sign-in ID'.padEnd(28) + 'PIN',
    '  ' + '─'.repeat(66),
    ...rows,
    '  ' + '─'.repeat(66),
    '',
  ].join('\n')
);
console.log(`  Also saved to ${path.relative(process.cwd(), credFile)}\n`);
