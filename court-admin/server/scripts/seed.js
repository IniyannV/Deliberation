/*
 * Demo data for Court Admin: an admin and a clerk account, the fictional
 * People v. Dana Whitlock case ready to export (charges, exhibits, PINs and
 * a sign-off), a second case still in draft, a Texas trial (State v. Cody
 * Ray Brennan) also ready to export, and the menu and supplies.
 *
 * Stop the server first. The previous audit log is archived, never deleted.
 * Sign-ins (and the demo jury PINs) are saved to data/demo-credentials.txt,
 * which is git-ignored.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { AUDIT_FILE, DATA_DIR, DB_FILE, PORT, UPLOAD_DIR } from '../config.js';
import { db, defaultData, initDb } from '../db.js';
import { hashPassword, randomPassword } from '../auth.js';
import { audit, initAudit } from '../services/audit.js';
import { exhibitFingerprint, generatePins, newJury } from '../lib/cases.js';
import { newId, nowIso, parseTranscript, probeVideoFps } from '../lib/shared.js';
import { CASE, MENU, SUPPLIES } from '../../../server/scripts/lib/case-content.js';
import { DEMO_EXHIBITS, renderDemoExhibit } from '../../../server/scripts/lib/demo-exhibits.js';
import { TEXAS_CASE, TEXAS_EXHIBITS, TEXAS_JURY, TEXAS_SIGNOFF, renderTexasExhibit } from '../../../server/scripts/lib/texas-case.js';

const serverUp = await new Promise((resolve) => {
  const socket = net.connect(PORT, '127.0.0.1').once('connect', () => { socket.destroy(); resolve(true); }).once('error', () => resolve(false));
});
if (serverUp) {
  console.error(`The Court Admin server is running on port ${PORT}. Stop it first, then run the seed again.`);
  process.exit(1);
}

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
audit({ actor: 'system', action: 'seed.demo_created' });

/* ── Accounts ── */
const logins = [];
const account = (username, name, role) => {
  const password = randomPassword();
  const user = { id: newId('usr'), username, name, role, active: true, createdAt: nowIso(), ...hashPassword(password) };
  db.data.users.push(user);
  logins.push({ who: `${name} (${role})`, signIn: username, secret: password });
  return user;
};
const admin = account('admin', 'Court Administrator', 'admin');
account('clerk', 'Deputy Clerk R. Patel', 'clerk');

/* ── The ready case ── */
const now = nowIso();
const ready = {
  id: newId('case'),
  caption: CASE.caption,
  caseNumber: CASE.caseNumber,
  court: CASE.court,
  burden: CASE.burden,
  counts: CASE.counts,
  status: 'active',
  jury: { ...newJury(), bailiff: { login: 'B1', name: 'Bailiff T. Morrow' } },
  signoff: null,
  exports: [],
  createdAt: now,
  createdBy: admin.id,
  updatedAt: now,
};
db.data.cases.push(ready);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
async function addExhibits(c, defs, render) {
  for (const def of defs) {
    const { buffer, ext, mime, type } = await render(def);
    const stored = `${newId('file')}${ext}`;
    const filePath = path.join(UPLOAD_DIR, stored);
    fs.writeFileSync(filePath, buffer);
    db.data.exhibits.push({
      id: newId('ex'),
      caseId: c.id,
      number: def.number,
      title: def.title,
      party: def.party,
      dateAdmitted: def.dateAdmitted,
      description: def.description,
      status: 'admitted',
      type,
      file: { stored, mime, size: buffer.length, originalName: `${def.number}${ext}`, sha256: crypto.createHash('sha256').update(buffer).digest('hex') },
      lines: type === 'transcript' ? parseTranscript(def.text) : undefined,
      fps: type === 'video' ? probeVideoFps(filePath) : undefined,
      uploadedBy: admin.id,
      uploadedAt: now,
    });
  }
}
const signoff = (c, parties) => ({ ...parties, recordedBy: admin.id, recordedByName: admin.name, recordedAt: now, fingerprint: exhibitFingerprint(c.id) });

await addExhibits(ready, DEMO_EXHIBITS, renderDemoExhibit);
const pins = generatePins(ready, 'all');
ready.signoff = signoff(ready, { judge: 'Hon. M. Castellanos', prosecution: 'ADA L. Reyes', defense: 'J. Whitfield, Esq.', date: '2026-10-20' });

/* ── A case still being prepared ── */
db.data.cases.push({
  id: newId('case'),
  caption: 'People v. Rafael Alvarez',
  caseNumber: '26-CR-0533',
  court: 'Millbrook County Superior Court, Part 1',
  burden: CASE.burden,
  counts: [],
  status: 'active',
  jury: newJury(),
  signoff: null,
  exports: [],
  createdAt: now,
  createdBy: admin.id,
  updatedAt: now,
});

/* ── A Texas trial, also ready for the jury room ── */
const texas = {
  id: newId('case'),
  caption: TEXAS_CASE.caption,
  caseNumber: TEXAS_CASE.caseNumber,
  court: TEXAS_CASE.court,
  burden: TEXAS_CASE.burden,
  counts: TEXAS_CASE.counts,
  status: 'active',
  jury: { ...newJury(), ...TEXAS_JURY },
  signoff: null,
  exports: [],
  createdAt: now,
  createdBy: admin.id,
  updatedAt: now,
};
db.data.cases.push(texas);
await addExhibits(texas, TEXAS_EXHIBITS, renderTexasExhibit);
const texasPins = generatePins(texas, 'all');
texas.signoff = signoff(texas, TEXAS_SIGNOFF);

/* ── Menu & supplies ── */
db.data.menu = MENU.map((m) => ({ id: newId('menu'), ...m, available: true }));
db.data.supplies = SUPPLIES.map((name) => ({ id: newId('sup'), name, available: true }));

await db.write();

const table = (rows) => rows.map((r) => '  ' + r.who.padEnd(34) + r.signIn.padEnd(12) + r.secret);
const lines = [
  `Court Admin demo sign-ins (generated ${now})`,
  '',
  '  ' + 'Who'.padEnd(34) + 'Username'.padEnd(12) + 'Password',
  ...table(logins),
  '',
  `Jury-room PINs for ${CASE.caseNumber} (they travel in the case package as hashes)`,
  '',
  '  ' + 'Who'.padEnd(34) + 'Sign in'.padEnd(12) + 'PIN',
  ...table(pins.map((p) => ({ who: p.who, signIn: p.signIn, secret: p.pin }))),
  '',
  `Jury-room PINs for ${TEXAS_CASE.caseNumber}`,
  '',
  '  ' + 'Who'.padEnd(34) + 'Sign in'.padEnd(12) + 'PIN',
  ...table(texasPins.map((p) => ({ who: p.who, signIn: p.signIn, secret: p.pin }))),
  '',
];
const credFile = path.join(DATA_DIR, 'demo-credentials.txt');
fs.writeFileSync(credFile, lines.join('\n'));
console.log(`\nSeeded Court Admin: ${db.data.cases.length} cases, ${db.data.exhibits.length} exhibits.`);
console.log(`Sign-ins and demo PINs saved to ${path.relative(process.cwd(), credFile)}\n`);
