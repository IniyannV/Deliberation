import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { ROLES, requireRole } from '../auth.js';
import { MEDIA_DIR } from '../config.js';
import { HttpError } from '../lib/util.js';

/*
 * Audio for the wellbeing hub is read straight from /server/media. A court
 * adds licensed audiobooks or music by copying files into that folder and,
 * optionally, describing them in media/catalog.json (see media/README.md).
 */

const router = Router();
const AUDIO = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.flac': 'audio/flac' };

function catalog() {
  const file = path.join(MEDIA_DIR, 'catalog.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

router.get('/', requireRole(ROLES.JUROR), (_req, res) => {
  if (!fs.existsSync(MEDIA_DIR)) return res.json({ tracks: [] });
  const described = new Map(catalog().map((c) => [c.file, c]));
  const tracks = fs
    .readdirSync(MEDIA_DIR)
    .filter((f) => AUDIO[path.extname(f).toLowerCase()])
    .sort()
    .map((file) => {
      const c = described.get(file) ?? {};
      return {
        file,
        title: c.title ?? path.basename(file, path.extname(file)).replace(/[-_]+/g, ' '),
        creator: c.creator ?? '',
        kind: c.kind ?? 'music',
        description: c.description ?? '',
        size: fs.statSync(path.join(MEDIA_DIR, file)).size,
      };
    });
  res.json({ tracks });
});

router.get('/:file', requireRole(ROLES.JUROR), (req, res) => {
  const file = path.basename(req.params.file);
  const type = AUDIO[path.extname(file).toLowerCase()];
  const full = path.join(MEDIA_DIR, file);
  if (!type || !fs.existsSync(full)) throw new HttpError(404, 'Track not found');
  res.type(type);
  res.sendFile(full); // supports Range requests for seeking
});

export default router;
