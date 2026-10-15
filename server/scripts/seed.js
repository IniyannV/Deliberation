/*
 * npm run seed: creates a fictional case for demos.
 * Stop the server first; this replaces server/data/db.json.
 *
 * To load a real case instead, a clerk can run this once to create seats and
 * staff accounts, then remove the demo exhibits and upload real ones from
 * /admin/evidence (or edit CASE in scripts/lib/case-content.js).
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, DB_FILE, AUDIT_FILE, UPLOAD_DIR } from '../config.js';
import { defaultData, initDb, db } from '../db.js';
import { hashPin, randomPin } from '../auth.js';
import { audit, initAudit } from '../services/audit.js';
import { parseTranscript } from '../lib/exhibits.js';
import { validateInteractive } from '../lib/interactive.js';
import { LOSS_CHART, MAP_EXHIBIT, PHONE_CHART } from './lib/interactive-exhibits.js';
import { newId, nowIso } from '../lib/util.js';
import {
  CASE, FAMILY_UPDATES, MENU, SUPPLIES, TRANSCRIPT_DELGADO, TRANSCRIPT_OKAFOR,
} from './lib/case-content.js';
import { IMAGE_EXHIBITS, PDF_EXHIBITS } from './lib/documents.js';

const FOREPERSON_SEAT = 1;

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
const exhibitDefs = [
  { number: 'P-1', title: 'Police incident report', party: 'prosecution', dateAdmitted: '2026-09-14', kind: 'pdf', description: 'Report of Officer R. Delgado, March 14–15, 2026.' },
  { number: 'P-2', title: 'Photograph: rear service door', party: 'prosecution', dateAdmitted: '2026-09-14', kind: 'image', description: 'Taken 12:14 AM, March 15, 2026, showing pry marks near the latch.' },
  { number: 'P-3', title: 'Store floor plan', party: 'prosecution', dateAdmitted: '2026-09-14', kind: 'image', description: "Diagram of Callan's Hardware prepared by the store manager." },
  { number: 'P-4', title: 'Inventory loss statement', party: 'prosecution', dateAdmitted: '2026-09-15', kind: 'pdf', description: 'Itemized merchandise, cash and repair losses.' },
  { number: 'P-5', title: 'Surveillance still, CAM 2, 11:42 PM', party: 'prosecution', dateAdmitted: '2026-09-15', kind: 'image', description: 'Rear lot camera frame showing one hooded figure.' },
  { number: 'P-6', title: 'Phone records excerpt', party: 'prosecution', dateAdmitted: '2026-09-16', kind: 'pdf', description: 'Carrier call-detail records for the number ending 4417.' },
  { number: 'D-1', title: 'Brightline timecard records', party: 'defense', dateAdmitted: '2026-09-17', kind: 'pdf', description: "Defendant's clock-in and clock-out times, week of March 9." },
  { number: 'D-2', title: 'Route map: warehouse to store', party: 'defense', dateAdmitted: '2026-09-17', kind: 'image', description: 'Driving route and distance between Warehouse 3 and Ferris Street.' },
  { number: 'Tr-1', title: 'Transcript: Officer Rosa Delgado', party: 'court', dateAdmitted: '2026-09-14', kind: 'transcript', text: TRANSCRIPT_DELGADO, description: 'Direct and cross-examination.' },
  { number: 'Tr-2', title: 'Transcript: Maya Okafor (store manager)', party: 'court', dateAdmitted: '2026-09-15', kind: 'transcript', text: TRANSCRIPT_OKAFOR, description: 'Direct and cross-examination.' },
  { number: 'J-1', title: 'Interactive map: downtown Millbrook', party: 'joint', dateAdmitted: '2026-09-17', kind: 'json', spec: MAP_EXHIBIT, description: 'Demonstrative map agreed by both parties: key locations, the D-2 driving route and approximate cell coverage.' },
  { number: 'P-7', title: 'Interactive chart: losses by item', party: 'prosecution', dateAdmitted: '2026-09-15', kind: 'json', spec: LOSS_CHART, description: 'Chart of the figures in the inventory loss statement (P-4).' },
  { number: 'D-3', title: 'Interactive chart: phone activity by tower', party: 'defense', dateAdmitted: '2026-09-17', kind: 'json', spec: PHONE_CHART, description: 'The call-detail records in P-6, plotted by time and tower.' },
];

for (const def of exhibitDefs) {
  let buffer, ext, mime, type;
  if (def.kind === 'pdf') { buffer = await PDF_EXHIBITS[def.number](); ext = '.pdf'; mime = 'application/pdf'; type = 'pdf'; }
  if (def.kind === 'image') { buffer = IMAGE_EXHIBITS[def.number](); ext = '.png'; mime = 'image/png'; type = 'image'; }
  if (def.kind === 'transcript') { buffer = Buffer.from(def.text + '\n', 'utf8'); ext = '.txt'; mime = 'text/plain; charset=utf-8'; type = 'transcript'; }
  const spec = def.kind === 'json' ? validateInteractive(def.spec) : undefined;
  if (spec) { buffer = Buffer.from(JSON.stringify(def.spec, null, 2)); ext = '.json'; mime = 'application/json'; type = spec.kind; }
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
    spec,
    uploadedBy: bailiff.id,
    uploadedAt: nowIso(),
  };
  db.data.exhibits.push(exhibit);
  audit({ actor: bailiff.id, role: 'bailiff', action: 'exhibit.uploaded', target: exhibit.id, meta: { exhibitNumber: exhibit.number, exhibitType: type } });
}

/* ── Menu, supplies, family updates ── */
db.data.menu = MENU.map((m) => ({ id: newId('menu'), ...m, available: true }));
db.data.supplies = SUPPLIES.map((name) => ({ id: newId('sup'), name, available: true }));

for (const u of FAMILY_UPDATES) {
  const seat = db.data.users.find((x) => x.kind === 'juror' && x.seat === u.seat);
  const update = { id: newId('upd'), seatId: seat.id, body: u.body, bailiffId: bailiff.id, createdAt: nowIso(), readAt: null };
  db.data.updates.push(update);
  audit({ actor: bailiff.id, role: 'bailiff', action: 'update.sent', target: update.id, meta: { seat: u.seat } });
}

await db.write();

/* ── Credentials ── */
console.log(`\nSeeded "${CASE.caption}" (${CASE.caseNumber})`);
console.log(`  ${db.data.exhibits.length} exhibits · ${db.data.menu.length} menu items · ${db.data.updates.length} family updates\n`);
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
