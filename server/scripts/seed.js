/*
 * npm run seed: creates a fictional case for demos.
 * Stop the server first; this replaces server/data/db.json.
 *
 * To load a real case instead, a clerk can run this once to create seats and
 * staff accounts, then remove the demo exhibits and upload real ones from
 * /admin/evidence (or edit CASE in scripts/lib/case-content.js).
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
import { CASE, MENU, SUPPLIES } from './lib/case-content.js';
import { DEMO_EXHIBITS, renderDemoExhibit } from './lib/demo-exhibits.js';
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
db.data.case = CASE;

/* ── Accounts ── */
const credentials = [];
for (let seat = 1; seat <= 12; seat++) {
  const pin = randomPin();
  db.data.users.push({ id: `seat-${String(seat).padStart(2, '0')}`, kind: 'juror', seat, isForeperson: seat === FOREPERSON_SEAT, active: true, ...hashPin(pin) });
  credentials.push({ who: `Juror seat ${seat}${seat === FOREPERSON_SEAT ? ' (foreperson)' : ''}`, signIn: String(seat), pin });
}
const bailiffPin = randomPin();
db.data.users.push({ id: 'bailiff-01', kind: 'bailiff', login: 'B1', name: 'Bailiff T. Morrow', active: true, ...hashPin(bailiffPin) });
credentials.push({ who: 'Bailiff / Clerk', signIn: 'B1', pin: bailiffPin });
const displayPin = randomPin();
db.data.users.push({ id: 'display-01', kind: 'display', login: 'DISPLAY', name: 'Room Display', active: true, ...hashPin(displayPin) });
credentials.push({ who: 'Room display (projector)', signIn: 'DISPLAY', pin: displayPin });

const bailiff = db.data.users.find((u) => u.id === 'bailiff-01');
audit({ actor: 'system', role: 'system', action: 'seed.case_created' });

/* ── Exhibits ── */
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
for (const def of DEMO_EXHIBITS) {
  const { buffer, ext, mime, type } = await renderDemoExhibit(def);
  const stored = `${newId('file')}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), buffer);
  const exhibit = {
    id: newId('ex'),
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
  audit({ actor: bailiff.id, role: 'bailiff', action: 'exhibit.uploaded', target: exhibit.id, meta: { exhibitNumber: exhibit.number, exhibitType: type } });
}

/* ── A shared timeline already filled in, to demo ── */
db.data.timeline = demoTimeline(CASE.caseNumber, db.data.exhibits);

/* ── Menu and supplies ── */
db.data.menu = MENU.map((m) => ({ id: newId('menu'), ...m, available: true }));
db.data.supplies = SUPPLIES.map((name) => ({ id: newId('sup'), name, available: true }));

await db.write();

/* ── Credentials ── */
console.log(`\nSeeded "${CASE.caption}" (${CASE.caseNumber})`);
console.log(`  ${db.data.exhibits.length} exhibits · ${db.data.timeline.length} timeline events · ${db.data.menu.length} menu items\n`);
console.log('  Sign-in credentials (shown once; PINs are stored only as hashes):\n');
console.log('  ' + 'Who'.padEnd(30) + 'Seat / ID'.padEnd(12) + 'PIN');
console.log('  ' + '─'.repeat(50));
const rows = credentials.map((c) => '  ' + c.who.padEnd(30) + c.signIn.padEnd(12) + c.pin);
for (const r of rows) console.log(r);
console.log('\n  The clerk can reset any juror PIN from /admin/jurors.');

// Demo convenience: the same table, saved where the git-ignored data lives.
const credFile = path.join(DATA_DIR, 'demo-credentials.txt');
fs.writeFileSync(credFile, [`Demo sign-ins for "${CASE.caption}" (generated ${nowIso()})`, '', '  ' + 'Who'.padEnd(30) + 'Seat / ID'.padEnd(12) + 'PIN', ...rows, ''].join('\n'));
console.log(`  Also saved to ${path.relative(process.cwd(), credFile)}\n`);
