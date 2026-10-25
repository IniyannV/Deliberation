import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { db, save } from '../db.js';
import { ROLES, requireRole } from '../auth.js';
import { JURY_SERVER_URL, MAX_UPLOAD_BYTES, PACKAGE_FORMAT, UPLOAD_DIR } from '../config.js';
import { auditAs } from '../services/audit.js';
import { FILE_CSP } from '../lib/security.js';
import {
  HttpError, PARTIES, bad, isoDate, newId, nowIso, oneOf, optStr, parseTranscript, probeVideoFps, sniffFile, str, writeTar,
} from '../lib/shared.js';
import {
  admittedExhibits, assertUniqueCaseNumber, caseExhibits, caseSummary, caseView, DEFAULT_BURDEN, exhibitFingerprint,
  findCase, generatePins, newCaseId, newJury, publicExhibit, readCounts, readDetails, readiness, readJury, readSignoff, touch,
} from '../lib/cases.js';

const router = Router();
router.use(requireRole(ROLES.ANY));

/* ── Cases ────────────────────────────────────────────────────────── */

router.get('/', (_req, res) => {
  const cases = db.data.cases.map(caseSummary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  res.json({ cases });
});

router.post('/', async (req, res) => {
  const details = readDetails({ burden: DEFAULT_BURDEN, ...req.body });
  assertUniqueCaseNumber(details.caseNumber);
  const c = {
    id: newCaseId(),
    ...details,
    status: 'active',
    counts: [],
    jury: newJury(),
    signoff: null,
    exports: [],
    createdAt: nowIso(),
    createdBy: req.user.id,
    updatedAt: nowIso(),
  };
  db.data.cases.push(c);
  await save();
  auditAs(req.user, 'case.created', c.id, { caseNumber: c.caseNumber, caption: c.caption });
  res.status(201).json({ case: caseView(c) });
});

router.get('/:id', (req, res) => res.json({ case: caseView(findCase(req.params.id)) }));

router.patch('/:id', async (req, res) => {
  const c = findCase(req.params.id);
  const details = readDetails(req.body ?? {}, { partial: true });
  if (details.caseNumber) assertUniqueCaseNumber(details.caseNumber, c.id);
  const statusChanged = details.status && details.status !== c.status;
  Object.assign(c, details);
  touch(c);
  await save();
  auditAs(req.user, statusChanged ? 'case.status_set' : 'case.updated', c.id, {
    caseNumber: c.caseNumber, status: statusChanged ? c.status : undefined, fields: Object.keys(details).join(','),
  });
  res.json({ case: caseView(c) });
});

// Deleting removes the case's exhibits and files too. Only archived cases, and only admins.
router.delete('/:id', requireRole(ROLES.ADMIN), async (req, res) => {
  const c = findCase(req.params.id);
  if (c.status !== 'archived') throw bad('Archive the case before deleting it');
  const files = caseExhibits(c.id).map((e) => e.file.stored);
  db.data.exhibits = db.data.exhibits.filter((e) => e.caseId !== c.id);
  db.data.cases = db.data.cases.filter((x) => x.id !== c.id);
  await save();
  for (const f of files) fs.rmSync(path.join(UPLOAD_DIR, path.basename(f)), { force: true });
  auditAs(req.user, 'case.deleted', c.id, { caseNumber: c.caseNumber });
  res.json({ ok: true });
});

/* ── Charges ──────────────────────────────────────────────────────── */

router.put('/:id/counts', async (req, res) => {
  const c = findCase(req.params.id);
  c.counts = readCounts(req.body?.counts);
  touch(c);
  await save();
  auditAs(req.user, 'case.counts_updated', c.id, { caseNumber: c.caseNumber, countCount: c.counts.length });
  res.json({ case: caseView(c) });
});

/* ── Exhibits ─────────────────────────────────────────────────────── */

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${newId('file')}${path.extname(file.originalname).toLowerCase().slice(0, 6)}`),
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

const sha256File = async (filePath) => {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
};

function readExhibitMeta(body, { partial = false } = {}) {
  const meta = {};
  const has = (k) => !partial || body[k] !== undefined;
  if (has('number')) meta.number = str(body.number, { min: 1, max: 20, field: 'Exhibit number' });
  if (has('title')) meta.title = str(body.title, { min: 1, max: 160, field: 'Title' });
  if (has('party')) meta.party = oneOf(body.party, PARTIES, 'Party');
  if (has('dateAdmitted')) meta.dateAdmitted = isoDate(body.dateAdmitted, 'Date admitted');
  if (has('description')) meta.description = optStr(body.description, { max: 1000, field: 'Description' });
  if (body.status !== undefined) meta.status = oneOf(body.status, ['admitted', 'withdrawn'], 'Status');
  return meta;
}

const assertUniqueNumber = (caseId, number, exceptId) => {
  if (caseExhibits(caseId).some((e) => e.id !== exceptId && e.number.toLowerCase() === number.toLowerCase())) {
    throw bad(`Exhibit ${number} already exists in this case`);
  }
};

const findExhibit = (id) => {
  const e = db.data.exhibits.find((x) => x.id === id);
  if (!e) throw new HttpError(404, 'Exhibit not found');
  return e;
};

const filePathOf = (e) => path.join(UPLOAD_DIR, path.basename(e.file.stored));

/** Check an uploaded file by its content and read what the jury app needs from it. */
async function describeUpload(file) {
  const sniffed = sniffFile(file.path, file.originalname);
  if (!sniffed || sniffed.type === 'youtube') {
    throw bad('Unsupported file. Use PDF, PNG, JPEG, WebP, GIF, a .txt transcript, or an MP4, MOV or WebM video.');
  }
  return {
    type: sniffed.type,
    file: { stored: file.filename, mime: sniffed.mime, size: file.size, originalName: file.originalname.slice(0, 200), sha256: await sha256File(file.path) },
    lines: sniffed.type === 'transcript' ? parseTranscript(fs.readFileSync(file.path, 'utf8')) : undefined,
    fps: sniffed.type === 'video' ? probeVideoFps(file.path) : undefined,
  };
}

router.post('/:id/exhibits', upload.single('file'), async (req, res) => {
  if (!req.file) throw bad('Choose a file to upload');
  try {
    const c = findCase(req.params.id);
    const meta = readExhibitMeta(req.body ?? {});
    assertUniqueNumber(c.id, meta.number);
    const exhibit = {
      id: newId('ex'),
      caseId: c.id,
      status: 'admitted',
      ...meta,
      ...(await describeUpload(req.file)),
      uploadedBy: req.user.id,
      uploadedAt: nowIso(),
    };
    db.data.exhibits.push(exhibit);
    touch(c);
    await save();
    auditAs(req.user, 'exhibit.uploaded', exhibit.id, { caseNumber: c.caseNumber, exhibitNumber: exhibit.number, exhibitType: exhibit.type });
    res.status(201).json({ exhibit: publicExhibit(exhibit), case: caseView(c) });
  } catch (err) {
    fs.rmSync(req.file.path, { force: true });
    throw err;
  }
});

router.get('/exhibits/:eid', (req, res) => {
  const e = findExhibit(req.params.eid);
  res.json({ exhibit: { ...publicExhibit(e), lines: e.lines ?? null } });
});

router.get('/exhibits/:eid/file', (req, res) => {
  const e = findExhibit(req.params.eid);
  const filePath = filePathOf(e);
  if (!fs.existsSync(filePath)) throw new HttpError(404, 'This exhibit’s file is missing. Upload it again.');
  res.setHeader('Content-Type', e.file.mime);
  res.setHeader('Content-Security-Policy', FILE_CSP);
  const name = `${e.number}${path.extname(e.file.stored)}`.replace(/[^\w.-]/g, '_');
  res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${name}"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.sendFile(filePath);
});

router.patch('/exhibits/:eid', async (req, res) => {
  const e = findExhibit(req.params.eid);
  const c = findCase(e.caseId);
  const meta = readExhibitMeta(req.body ?? {}, { partial: true });
  if (meta.number) assertUniqueNumber(c.id, meta.number, e.id);
  const statusChanged = meta.status && meta.status !== e.status;
  Object.assign(e, meta, { updatedAt: nowIso() });
  touch(c);
  await save();
  auditAs(req.user, statusChanged ? 'exhibit.status_set' : 'exhibit.updated', e.id, {
    caseNumber: c.caseNumber, exhibitNumber: e.number, status: statusChanged ? e.status : undefined,
  });
  res.json({ exhibit: publicExhibit(e), case: caseView(c) });
});

// Replace an exhibit's file (a corrected scan, say). The sign-off no longer matches afterwards.
router.post('/exhibits/:eid/file', upload.single('file'), async (req, res) => {
  if (!req.file) throw bad('Choose a file to upload');
  try {
    const e = findExhibit(req.params.eid);
    const c = findCase(e.caseId);
    const old = filePathOf(e);
    const described = await describeUpload(req.file);
    Object.assign(e, described, { lines: described.lines, fps: described.fps, updatedAt: nowIso() });
    touch(c);
    await save();
    fs.rmSync(old, { force: true });
    auditAs(req.user, 'exhibit.file_replaced', e.id, { caseNumber: c.caseNumber, exhibitNumber: e.number, exhibitType: e.type });
    res.json({ exhibit: publicExhibit(e), case: caseView(c) });
  } catch (err) {
    fs.rmSync(req.file.path, { force: true });
    throw err;
  }
});

// For mistakes only (wrong file, wrong case). A real exhibit the court withdraws is marked withdrawn instead.
router.delete('/exhibits/:eid', async (req, res) => {
  const e = findExhibit(req.params.eid);
  const c = findCase(e.caseId);
  db.data.exhibits = db.data.exhibits.filter((x) => x.id !== e.id);
  touch(c);
  await save();
  fs.rmSync(filePathOf(e), { force: true });
  auditAs(req.user, 'exhibit.deleted', e.id, { caseNumber: c.caseNumber, exhibitNumber: e.number });
  res.json({ case: caseView(c) });
});

/* ── Jury seats and PINs ──────────────────────────────────────────── */

router.patch('/:id/jury', async (req, res) => {
  const c = findCase(req.params.id);
  c.jury = readJury(req.body ?? {}, c.jury);
  touch(c);
  await save();
  auditAs(req.user, 'case.jury_updated', c.id, { caseNumber: c.caseNumber, seatCount: c.jury.seatCount });
  res.json({ case: caseView(c) });
});

// Plain PINs are in this response only. Print the sheet now; they can't be shown again.
router.post('/:id/pins', async (req, res) => {
  const c = findCase(req.params.id);
  const which = Array.isArray(req.body?.which) ? req.body.which : String(req.body?.which ?? 'missing');
  const pins = generatePins(c, which);
  touch(c);
  await save();
  auditAs(req.user, 'case.pins_generated', c.id, { caseNumber: c.caseNumber, which: [which].flat().join(','), itemCount: pins.length });
  res.json({ pins, case: caseView(c) });
});

/* ── Sign-off ─────────────────────────────────────────────────────── */

router.post('/:id/signoff', async (req, res) => {
  const c = findCase(req.params.id);
  if (!admittedExhibits(c.id).length) throw bad('Add the admitted exhibits before recording the sign-off');
  c.signoff = { ...readSignoff(req.body ?? {}), recordedBy: req.user.id, recordedByName: req.user.name, recordedAt: nowIso(), fingerprint: exhibitFingerprint(c.id) };
  touch(c);
  await save();
  auditAs(req.user, 'case.signoff_recorded', c.id, { caseNumber: c.caseNumber, itemCount: admittedExhibits(c.id).length });
  res.json({ case: caseView(c) });
});

router.delete('/:id/signoff', async (req, res) => {
  const c = findCase(req.params.id);
  c.signoff = null;
  touch(c);
  await save();
  auditAs(req.user, 'case.signoff_cleared', c.id, { caseNumber: c.caseNumber });
  res.json({ case: caseView(c) });
});

/* ── Export ───────────────────────────────────────────────────────── */

const BLOCK = 512;
const tarSize = (sizes) => sizes.reduce((sum, s) => sum + BLOCK + Math.ceil(s / BLOCK) * BLOCK, 0) + 2 * BLOCK;
const pinOf = (p) => ({ pinHash: p.pinHash, pinSalt: p.pinSalt });

/*
 * The case package: a plain tar holding manifest.json, its SHA-256 in
 * manifest.sha256, and one file per admitted exhibit. The jury server
 * loads it (from "Send to jury iPads", or `npm run import-case` for a
 * copy), checking every file against the SHA-256 in the manifest.
 */
function buildPackage(c, user) {
  const { ready, checks } = readiness(c);
  if (!ready) throw bad(`Not ready for the jury room: ${checks.filter((x) => !x.ok).map((x) => x.label.toLowerCase()).join('; ')}`);

  const exhibits = admittedExhibits(c.id);
  for (const e of exhibits) {
    if (!fs.existsSync(filePathOf(e))) throw bad(`Exhibit ${e.number}’s file is missing. Upload it again.`);
  }
  const manifest = {
    format: PACKAGE_FORMAT,
    exportedAt: nowIso(),
    exportedBy: user.name,
    case: { id: c.id, caption: c.caption, caseNumber: c.caseNumber, court: c.court, burden: c.burden, counts: c.counts },
    jury: {
      seatCount: c.jury.seatCount,
      foreperson: c.jury.foreperson,
      seats: Array.from({ length: c.jury.seatCount }, (_, i) => ({ seat: i + 1, name: c.jury.names?.[i + 1] || undefined, ...pinOf(c.jury.seats[i + 1]) })),
      bailiff: { login: c.jury.bailiff.login, name: c.jury.bailiff.name, ...pinOf(c.jury.bailiff) },
      display: pinOf(c.jury.display),
    },
    exhibits: exhibits.map((e) => ({
      id: e.id,
      number: e.number,
      title: e.title,
      party: e.party,
      dateAdmitted: e.dateAdmitted,
      description: e.description ?? '',
      type: e.type,
      originalName: e.file.originalName,
      size: e.file.size,
      sha256: e.file.sha256,
      path: `exhibits/${path.basename(e.file.stored)}`,
    })),
    menu: db.data.menu.map(({ name, category, dietary, available }) => ({ name, category, dietary, available })),
    supplies: db.data.supplies.map(({ name, available }) => ({ name, available })),
    signoff: { judge: c.signoff.judge, prosecution: c.signoff.prosecution, defense: c.signoff.defense, date: c.signoff.date, recordedBy: c.signoff.recordedByName, recordedAt: c.signoff.recordedAt },
  };
  const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2));
  // Lets the importer notice a damaged manifest (the charges and PINs live there), as the exhibit checksums do for files.
  const manifestSum = Buffer.from(crypto.createHash('sha256').update(manifestBuf).digest('hex'));
  const entries = [
    { name: 'manifest.json', data: manifestBuf },
    { name: 'manifest.sha256', data: manifestSum },
    ...exhibits.map((e) => ({ name: `exhibits/${path.basename(e.file.stored)}`, path: filePathOf(e) })),
  ];
  const bytes = tarSize([manifestBuf.length, manifestSum.length, ...exhibits.map((e) => fs.statSync(filePathOf(e)).size)]);
  return { entries, bytes, exhibitCount: exhibits.length };
}

async function recordExport(c, user, { bytes, exhibitCount }, method) {
  c.exports.push({ at: nowIso(), by: user.id, byName: user.name, bytes, exhibitCount, method });
  await save();
  auditAs(user, method === 'sent' ? 'case.sent_to_jury' : 'case.exported', c.id, { caseNumber: c.caseNumber, itemCount: exhibitCount, bytes });
}

// A copy of the package to download, for a jury laptop that isn't this machine.
router.get('/:id/export', async (req, res) => {
  const c = findCase(req.params.id);
  const pkg = buildPackage(c, req.user);
  const filename = `${c.caseNumber.replace(/[^\w.-]+/g, '_')}.jurycase.tar`;
  res.setHeader('Content-Type', 'application/x-tar');
  res.setHeader('Content-Length', String(pkg.bytes));
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  try {
    await writeTar(res, pkg.entries);
    res.end();
  } catch (err) {
    res.destroy();
    console.warn(`[export] ${c.caseNumber}: ${err.message}`);
    return;
  }
  // Recorded only once the whole package has gone out.
  await recordExport(c, req.user, pkg, 'download');
});

/** Stream the package to the jury server on this machine and return its answer. */
function postToJuryServer(pkg, { replace }) {
  const url = new URL(`/api/local/import${replace ? '?replace=1' : ''}`, JURY_SERVER_URL);
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/x-tar', 'Content-Length': String(pkg.bytes) } }, (res) => {
      let body = '';
      res.setEncoding('utf8').on('data', (d) => { body += d; }).on('end', () => {
        let json = {};
        try { json = JSON.parse(body); } catch { /* not JSON: use the status alone */ }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    writeTar(req, pkg.entries).then(() => req.end(), (err) => req.destroy(err));
  });
}

// Load the case straight into the jury server, which serves the jurors' iPads. Both run on this machine.
router.post('/:id/send', async (req, res) => {
  const c = findCase(req.params.id);
  const pkg = buildPackage(c, req.user);
  let answer;
  try {
    answer = await postToJuryServer(pkg, { replace: req.body?.replace === true });
  } catch {
    throw new HttpError(502, `The jury server isn’t running at ${JURY_SERVER_URL}. Start it with npm start, then send again.`);
  }
  // The jury server still holds another trial's deliberations: the clerk confirms, then sends with `replace`.
  if (answer.status === 409) throw new HttpError(409, answer.json.error);
  if (answer.status !== 200) throw new HttpError(502, answer.json.error ?? `The jury server refused the case (HTTP ${answer.status})`);
  await recordExport(c, req.user, pkg, 'sent');
  res.json({ case: caseView(c), loaded: answer.json });
});

export default router;
