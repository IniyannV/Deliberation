import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEXAS_CASE, TEXAS_DEMO_PINS } from '../server/scripts/lib/texas-case.js';
import { CASE } from '../server/scripts/lib/case-content.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_DATA = path.join(ROOT_DIR, 'server', 'data');
const serverDb = JSON.parse(fs.readFileSync(path.join(SERVER_DATA, 'db.json'), 'utf8'));

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

const cases = [
  {
    id: 'courtcase-3',
    case_number: TEXAS_CASE.caseNumber,
    title: TEXAS_CASE.caption,
    status: 'active',
    data: {
      id: 'courtcase-3',
      caption: TEXAS_CASE.caption,
      caseNumber: TEXAS_CASE.caseNumber,
      court: TEXAS_CASE.court,
      burden: TEXAS_CASE.burden,
      counts: TEXAS_CASE.counts,
      status: 'active',
      jury: { seats: [] },
    },
  },
  {
    id: 'courtcase-1',
    case_number: CASE.caseNumber,
    title: CASE.caption,
    status: 'active',
    data: {
      id: 'courtcase-1',
      caption: CASE.caption,
      caseNumber: CASE.caseNumber,
      court: CASE.court,
      burden: CASE.burden,
      counts: CASE.counts,
      status: 'active',
      jury: { seats: [] },
    },
  },
  {
    id: 'courtcase-2',
    case_number: '26-CR-0533',
    title: 'People v. Rafael Alvarez',
    status: 'active',
    data: {
      id: 'courtcase-2',
      caption: 'People v. Rafael Alvarez',
      caseNumber: '26-CR-0533',
      court: 'Millbrook County Superior Court, Part 1',
      burden: CASE.burden,
      counts: [],
      status: 'active',
      jury: { seats: [] },
    },
  },
];

const users = [
  // Court Admin accounts
  {
    id: 'court-admin-admin',
    username: 'admin',
    login: 'admin',
    role: 'admin',
    kind: 'admin',
    seat: null,
    name: 'Court Administrator',
    case_number: null,
    password_hash: 'kestrel-timber-95-upland',
    active: 1,
  },
  {
    id: 'court-admin-clerk',
    username: 'clerk',
    login: 'clerk',
    role: 'clerk',
    kind: 'clerk',
    seat: null,
    name: 'Deputy Clerk R. Patel',
    case_number: null,
    password_hash: 'timber-pebble-27-ember',
    active: 1,
  },
  // Jury Deliberation Foreperson (Seat 1)
  {
    id: `${TEXAS_CASE.caseNumber}-seat-01`,
    username: `${TEXAS_CASE.caseNumber}-1`,
    login: `${TEXAS_CASE.caseNumber}-1`,
    role: 'foreperson',
    kind: 'juror',
    seat: 1,
    name: 'Juror 1 (Foreperson)',
    case_number: TEXAS_CASE.caseNumber,
    password_hash: TEXAS_DEMO_PINS[1] || '863462',
    active: 1,
  },
];

// Jurors Seats 2 through 12
for (let seat = 2; seat <= 12; seat++) {
  users.push({
    id: `${TEXAS_CASE.caseNumber}-seat-${String(seat).padStart(2, '0')}`,
    username: `${TEXAS_CASE.caseNumber}-${seat}`,
    login: `${TEXAS_CASE.caseNumber}-${seat}`,
    role: 'juror',
    kind: 'juror',
    seat,
    name: `Juror ${seat}`,
    case_number: TEXAS_CASE.caseNumber,
    password_hash: TEXAS_DEMO_PINS[seat],
    active: 1,
  });
}

// Bailiff
users.push({
  id: `${TEXAS_CASE.caseNumber}-bailiff-01`,
  username: `${TEXAS_CASE.caseNumber}-B1`,
  login: 'B1',
  role: 'bailiff',
  kind: 'bailiff',
  seat: null,
  name: 'Bailiff J. Ortiz',
  case_number: TEXAS_CASE.caseNumber,
  password_hash: TEXAS_DEMO_PINS.bailiff || '906447',
  active: 1,
});

// Display
users.push({
  id: `${TEXAS_CASE.caseNumber}-display-01`,
  username: `${TEXAS_CASE.caseNumber}-DISPLAY`,
  login: 'DISPLAY',
  role: 'display',
  kind: 'display',
  seat: null,
  name: 'Room Display',
  case_number: TEXAS_CASE.caseNumber,
  password_hash: TEXAS_DEMO_PINS.display || '673490',
  active: 1,
});

// Backward compatibility test user
users.push({
  id: 'local-juror-1',
  username: 'juror1',
  login: 'juror1',
  role: 'juror',
  kind: 'juror',
  seat: 1,
  name: 'Juror 1',
  case_number: TEXAS_CASE.caseNumber,
  password_hash: '1234',
  active: 1,
});

const exhibits = serverDb.exhibits.map((ex) => ({
  id: ex.id,
  case_id: 'courtcase-3',
  r2_key: `exhibits/${ex.file.stored}`,
  filename: ex.file.originalName,
  content_type: ex.file.mime,
  size: ex.file.size,
  checksum: null,
  visibility: 'case',
  uploader_id: `${TEXAS_CASE.caseNumber}-bailiff-01`,
  number: ex.number,
  title: ex.title,
  party: ex.party,
  description: ex.description,
  type: ex.type,
  status: 'admitted',
  lines_json: ex.lines ? JSON.stringify(ex.lines) : null,
}));

const sqlStatements = [
  '-- Auto-generated demo seed data matching README.md and scripts/demo.js',
  'DELETE FROM sessions;',
  'DELETE FROM users;',
  'DELETE FROM exhibits;',
  'DELETE FROM cases;',
  '',
];

for (const c of cases) {
  sqlStatements.push(
    `INSERT INTO cases (id, case_number, title, status, data_json) VALUES (${escapeSql(c.id)}, ${escapeSql(c.case_number)}, ${escapeSql(c.title)}, ${escapeSql(c.status)}, ${escapeSql(JSON.stringify(c.data))});`
  );
}

sqlStatements.push('');

for (const u of users) {
  sqlStatements.push(
    `INSERT INTO users (id, username, login, role, kind, seat, name, case_number, password_hash, active) VALUES (${escapeSql(u.id)}, ${escapeSql(u.username)}, ${escapeSql(u.login)}, ${escapeSql(u.role)}, ${escapeSql(u.kind)}, ${u.seat === null ? 'NULL' : u.seat}, ${escapeSql(u.name)}, ${escapeSql(u.case_number)}, ${escapeSql(u.password_hash)}, ${u.active});`
  );
}

sqlStatements.push('');

for (const e of exhibits) {
  sqlStatements.push(
    `INSERT INTO exhibits (id, case_id, r2_key, filename, content_type, size, checksum, visibility, uploader_id, number, title, party, description, type, status, lines_json) VALUES (${escapeSql(e.id)}, ${escapeSql(e.case_id)}, ${escapeSql(e.r2_key)}, ${escapeSql(e.filename)}, ${escapeSql(e.content_type)}, ${e.size}, ${escapeSql(e.checksum)}, ${escapeSql(e.visibility)}, ${escapeSql(e.uploader_id)}, ${escapeSql(e.number)}, ${escapeSql(e.title)}, ${escapeSql(e.party)}, ${escapeSql(e.description)}, ${escapeSql(e.type)}, ${escapeSql(e.status)}, ${escapeSql(e.lines_json)});`
  );
}

const outSql = sqlStatements.join('\n') + '\n';
fs.writeFileSync(path.join(ROOT_DIR, 'cloudflare', 'seed.sql'), outSql);
fs.writeFileSync(path.join(ROOT_DIR, 'cloudflare', 'seed.local.sql'), outSql);
console.log(`Generated ${cases.length} cases, ${users.length} users, and ${exhibits.length} exhibits in cloudflare/seed.sql and cloudflare/seed.local.sql`);
