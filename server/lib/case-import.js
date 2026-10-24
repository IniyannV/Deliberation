import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { AUDIT_FILE, DATA_DIR, UPLOAD_DIR } from '../config.js';
import { defaultData, db } from '../db.js';
import { audit, resetAudit } from '../services/audit.js';
import { PARTIES, parseTranscript, probeVideoFps, sniffFile } from './exhibits.js';
import { listTar, readTarEntry, tarEntryStream } from './tar.js';
import { newId, nowIso } from './util.js';
import { demoTimeline } from '../scripts/lib/demo-timeline.js';

/*
 * Load a case package exported by Court Admin (a plain tar: manifest.json,
 * its SHA-256 in manifest.sha256, and one file per admitted exhibit) in
 * place of the current trial. Used by `npm run import-case` and by Court
 * Admin's "Send to jury iPads", which posts the package to this server.
 *
 * Nothing changes unless every check passes: the package format, the
 * SHA-256 of the manifest and of every exhibit, and each file's real type
 * (sniffed again here, never taken from the manifest). The previous audit
 * log is archived, never deleted. If this laptop still holds deliberation
 * work from another trial, the import stops unless `replace` is set.
 * `db` must already be initialised.
 */

const FORMAT = 'jurycase/1';

export class ImportError extends Error {
  constructor(message, code = 'invalid') {
    super(message);
    this.code = code;
  }
}

const fail = (msg, code) => { throw new ImportError(msg, code); };
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const isHash = (p) => /^[0-9a-f]{64}$/.test(p?.pinHash ?? '') && /^[0-9a-f]{32}$/.test(p?.pinSalt ?? '');

/** Read and check the package's manifest. */
function readManifest(file) {
  let entries;
  try {
    entries = listTar(file);
  } catch (err) {
    fail(err.message);
  }
  const byName = new Map(entries.map((e) => [e.name, e]));
  const manifestEntry = byName.get('manifest.json');
  if (!manifestEntry) fail('this is not a case package (no manifest.json).');

  const sumEntry = byName.get('manifest.sha256');
  const manifestBuf = readTarEntry(file, manifestEntry);
  if (!sumEntry || readTarEntry(file, sumEntry).toString('latin1').trim() !== crypto.createHash('sha256').update(manifestBuf).digest('hex')) {
    fail('the package manifest is damaged (its checksum does not match). Export it again.');
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestBuf.toString('utf8'));
  } catch {
    fail('the package manifest is unreadable.');
  }
  if (manifest.format !== FORMAT) fail(`this package is format “${manifest.format}”, but this laptop reads “${FORMAT}”. Update the jury app.`);

  const { case: kase, jury, exhibits = [] } = manifest;
  if (!text(kase?.caption, 160) || !text(kase?.caseNumber, 40) || !Array.isArray(kase.counts) || !kase.counts.length) fail('the case details in the package are incomplete.');
  if (!Array.isArray(jury?.seats) || !jury.seats.length || !jury.seats.every(isHash) || !isHash(jury.bailiff) || !isHash(jury.display)) {
    fail('the package is missing PINs for the jury, the bailiff or the room display.');
  }
  if (!text(jury.bailiff.login, 16) || /^\d{1,2}$/.test(jury.bailiff.login)) fail('the bailiff’s sign-in ID in the package is not valid.');
  if (!exhibits.length) fail('the package has no exhibits.');
  return { manifest, byName };
}

/** Copy each exhibit to `staging`, checking it on the way. */
async function stageExhibits(file, exhibits, byName, staging) {
  const numbers = new Set();
  const imported = [];
  for (const x of exhibits) {
    const entry = byName.get(x.path);
    if (!entry || !entry.size) fail(`exhibit ${x.number}’s file is missing from the package.`);
    if (!text(x.number, 20) || !text(x.title, 160) || !PARTIES.includes(x.party)) fail(`exhibit ${x.number ?? '?'} has incomplete details.`);
    if (numbers.has(x.number.toLowerCase())) fail(`exhibit number ${x.number} appears twice.`);
    numbers.add(x.number.toLowerCase());

    const ext = path.extname(x.path).toLowerCase().slice(0, 6);
    const stored = `${newId('file')}${ext}`;
    const dest = path.join(staging, stored);
    const hash = crypto.createHash('sha256');
    const source = tarEntryStream(file, entry).on('data', (chunk) => hash.update(chunk));
    await pipeline(source, fs.createWriteStream(dest));
    if (entry.size !== x.size || hash.digest('hex') !== x.sha256) {
      fail(`exhibit ${x.number} does not match its checksum. The package may be damaged; export it again.`);
    }
    const sniffed = sniffFile(dest, x.originalName || `${x.number}${ext}`);
    if (!sniffed || sniffed.type === 'youtube') fail(`exhibit ${x.number} is not a supported file type.`);
    imported.push({
      id: newId('ex'),
      number: x.number,
      title: x.title,
      party: x.party,
      dateAdmitted: /^\d{4}-\d{2}-\d{2}$/.test(x.dateAdmitted) ? x.dateAdmitted : nowIso().slice(0, 10),
      description: typeof x.description === 'string' ? x.description.slice(0, 1000) : '',
      type: sniffed.type,
      file: { stored, mime: sniffed.mime, size: x.size, originalName: String(x.originalName ?? '').slice(0, 200) },
      lines: sniffed.type === 'transcript' ? parseTranscript(fs.readFileSync(dest, 'utf8')) : undefined,
      fps: sniffed.type === 'video' ? probeVideoFps(dest) : undefined,
      uploadedBy: 'bailiff-01',
      uploadedAt: nowIso(),
    });
  }
  return imported;
}

/** Deliberation work for the case loaded now, which an import would wipe. */
export const leftoverWork = () => db.data.timeline.length + db.data.votes.length + db.data.requests.length + db.data.imageNotes.length;

/**
 * Check `file` and load it in place of the current trial. Throws an
 * ImportError (code 'leftover' when only `replace` is missing) and leaves
 * everything as it was if a check fails.
 */
export async function importCase(file, { replace = false, onProgress = () => {} } = {}) {
  const { manifest, byName } = readManifest(file);
  const { case: kase, jury, exhibits, menu = [], supplies = [] } = manifest;

  if (leftoverWork() && !replace) {
    fail(`this laptop still holds deliberation work for ${db.data.case.caseNumber || 'another case'}. Replace it only once the court is finished with it.`, 'leftover');
  }

  onProgress(`Checking ${exhibits.length} exhibits…`);
  const staging = path.join(DATA_DIR, `import-${Date.now()}`);
  fs.mkdirSync(staging, { recursive: true });
  let imported;
  try {
    imported = await stageExhibits(file, exhibits, byName, staging);
  } catch (err) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw err;
  }

  // Every check passed: replace the old trial.
  let archived = null;
  if (fs.existsSync(AUDIT_FILE)) {
    archived = AUDIT_FILE.replace('.jsonl', `.archived-${Date.now()}.jsonl`);
    fs.renameSync(AUDIT_FILE, archived);
  }
  resetAudit();
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  fs.renameSync(staging, UPLOAD_DIR);

  const data = defaultData();
  data.case = { caption: kase.caption, caseNumber: kase.caseNumber, court: kase.court ?? '', burden: kase.burden ?? '', counts: kase.counts };
  const pin = (p) => ({ pinHash: p.pinHash, pinSalt: p.pinSalt });
  for (const s of jury.seats) {
    const name = text(s.name, 80) ? s.name.trim() : undefined;
    data.users.push({ id: `seat-${String(s.seat).padStart(2, '0')}`, kind: 'juror', seat: s.seat, name, isForeperson: s.seat === jury.foreperson, active: true, ...pin(s) });
  }
  data.users.push({ id: 'bailiff-01', kind: 'bailiff', login: jury.bailiff.login, name: jury.bailiff.name || 'Bailiff', active: true, ...pin(jury.bailiff) });
  data.users.push({ id: 'display-01', kind: 'display', login: 'DISPLAY', name: 'Room Display', active: true, ...pin(jury.display) });
  data.exhibits = imported;
  data.menu = menu.map((m) => ({ id: newId('menu'), name: String(m.name).slice(0, 80), category: m.category || 'Main', dietary: m.dietary || '', available: m.available !== false }));
  data.supplies = supplies.map((s) => ({ id: newId('sup'), name: String(s.name).slice(0, 80), available: s.available !== false }));
  // The fictional sample cases arrive with their shared timeline already filled in.
  data.timeline = demoTimeline(kase.caseNumber, imported);
  db.data = data;
  await db.write();
  audit({ actor: 'system', role: 'system', action: 'case.imported', meta: { itemCount: imported.length } });

  return { manifest, archived, exhibitCount: imported.length, seatCount: jury.seats.length };
}
