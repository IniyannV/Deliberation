import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { db, save } from '../db.js';
import { ROLES, requireRole } from '../auth.js';
import { MAX_UPLOAD_BYTES, UPLOAD_DIR } from '../config.js';
import { auditAs } from '../services/audit.js';
import { emit } from '../realtime.js';
import { HttpError, bad, isoDate, newId, nowIso, oneOf, optStr, str } from '../lib/util.js';
import {
  PARTIES, compareExhibitNumbers, exhibitSummary, parseTranscript, searchExhibits, sniffFile,
} from '../lib/exhibits.js';

const router = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${newId('file')}${path.extname(file.originalname).toLowerCase().slice(0, 6)}`),
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

const findExhibit = (id) => {
  const e = db.data.exhibits.find((x) => x.id === id);
  if (!e) throw new HttpError(404, 'Exhibit not found');
  return e;
};

const broadcastChange = () => emit(['jurors', 'bailiffs', 'display'], 'exhibits:changed', { at: nowIso() });

function readMeta(body, { partial = false } = {}) {
  const meta = {};
  const has = (k) => !partial || body[k] !== undefined;
  if (has('number')) meta.number = str(body.number, { min: 1, max: 20, field: 'Exhibit number' });
  if (has('title')) meta.title = str(body.title, { min: 1, max: 160, field: 'Title' });
  if (has('party')) meta.party = oneOf(body.party, PARTIES, 'Party');
  if (has('dateAdmitted')) meta.dateAdmitted = isoDate(body.dateAdmitted, 'Date admitted');
  if (has('description')) meta.description = optStr(body.description, { max: 1000, field: 'Description' });
  return meta;
}

// Jurors, staff and the room display can browse metadata. Display needs labels for timeline attachments.
router.get('/', requireRole(ROLES.JUROR, ROLES.BAILIFF, ROLES.DISPLAY), (req, res) => {
  const { q, type, party } = req.query;
  const list = searchExhibits(db.data.exhibits, { q, type, party }).sort(compareExhibitNumbers);
  res.json({ exhibits: list });
});

router.get('/:id', requireRole(ROLES.JUROR, ROLES.BAILIFF), (req, res) => {
  const e = findExhibit(req.params.id);
  res.json({ exhibit: { ...exhibitSummary(e), lines: e.lines ?? null, spec: e.spec ?? null } });
});

router.get('/:id/file', requireRole(ROLES.JUROR, ROLES.BAILIFF), (req, res) => {
  const e = findExhibit(req.params.id);
  const filePath = path.join(UPLOAD_DIR, path.basename(e.file.stored));
  res.setHeader('Content-Type', e.file.mime);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.sendFile(filePath);
});

router.post('/', requireRole(ROLES.BAILIFF), upload.single('file'), async (req, res) => {
  if (!req.file) throw bad('Choose a file to upload');
  try {
    const meta = readMeta(req.body);
    if (db.data.exhibits.some((e) => e.number.toLowerCase() === meta.number.toLowerCase())) {
      throw bad(`Exhibit ${meta.number} already exists`);
    }
    const sniffed = sniffFile(req.file.path, req.file.originalname);
    if (!sniffed) throw bad('Unsupported file. Use PDF, PNG, JPEG, WebP, GIF, a .txt transcript, or a .json interactive map/chart.');
    const exhibit = {
      id: newId('ex'),
      ...meta,
      type: sniffed.type,
      file: { stored: req.file.filename, mime: sniffed.mime, size: req.file.size, originalName: req.file.originalname.slice(0, 200) },
      lines: sniffed.type === 'transcript' ? parseTranscript(fs.readFileSync(req.file.path, 'utf8')) : undefined,
      spec: sniffed.spec,
      uploadedBy: req.user.id,
      uploadedAt: nowIso(),
    };
    db.data.exhibits.push(exhibit);
    await save();
    auditAs(req.user, req.role, 'exhibit.uploaded', exhibit.id, { exhibitNumber: exhibit.number, exhibitType: exhibit.type });
    broadcastChange();
    res.status(201).json({ exhibit: exhibitSummary(exhibit) });
  } catch (err) {
    fs.rmSync(req.file.path, { force: true });
    throw err;
  }
});

router.patch('/:id', requireRole(ROLES.BAILIFF), async (req, res) => {
  const e = findExhibit(req.params.id);
  const meta = readMeta(req.body ?? {}, { partial: true });
  if (meta.number && db.data.exhibits.some((x) => x.id !== e.id && x.number.toLowerCase() === meta.number.toLowerCase())) {
    throw bad(`Exhibit ${meta.number} already exists`);
  }
  Object.assign(e, meta, { updatedAt: nowIso() });
  await save();
  auditAs(req.user, req.role, 'exhibit.updated', e.id, { exhibitNumber: e.number });
  broadcastChange();
  res.json({ exhibit: exhibitSummary(e) });
});

router.delete('/:id', requireRole(ROLES.BAILIFF), async (req, res) => {
  const e = findExhibit(req.params.id);
  db.data.exhibits = db.data.exhibits.filter((x) => x.id !== e.id);
  db.data.transcriptLinks = db.data.transcriptLinks.filter((l) => l.exhibitId !== e.id && l.transcriptId !== e.id);
  db.data.imageNotes = db.data.imageNotes.filter((n) => n.exhibitId !== e.id);
  await save();
  fs.rmSync(path.join(UPLOAD_DIR, path.basename(e.file.stored)), { force: true });
  auditAs(req.user, req.role, 'exhibit.removed', e.id, { exhibitNumber: e.number });
  broadcastChange();
  emit(['jurors'], 'links:changed', db.data.transcriptLinks);
  emit(['jurors'], 'notes:changed', db.data.imageNotes);
  res.json({ ok: true });
});

export default router;
