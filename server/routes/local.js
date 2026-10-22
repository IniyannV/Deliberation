import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Router } from 'express';
import { DATA_DIR } from '../config.js';
import { ImportError, importCase } from '../lib/case-import.js';
import { resetVotes } from '../services/voting.js';
import { getIo } from '../realtime.js';
import { HttpError } from '../lib/util.js';

/*
 * Court Admin, running on this same machine, sends a case package here
 * ("Send to jury iPads"). Only this machine can reach it: requests from
 * juror iPads on the LAN are refused, and so is anything a web page could
 * send (a browser can't post application/x-tar to another site without
 * permission, and the Host check stops DNS rebinding).
 */

const router = Router();

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

let busy = false;

router.post('/import', async (req, res) => {
  if (!LOOPBACK.has(req.socket.remoteAddress) || !LOCAL_HOST.test(req.headers.host ?? '')) throw new HttpError(403, 'Only Court Admin on this machine can load a case');
  if (!req.is('application/x-tar')) throw new HttpError(415, 'Send a case package');
  if (busy) throw new HttpError(409, 'Another case is loading. Try again in a moment.');
  busy = true;
  const tmp = path.join(DATA_DIR, `incoming-${Date.now()}.tar`);
  try {
    await pipeline(req, fs.createWriteStream(tmp));
    const { manifest, exhibitCount, seatCount } = await importCase(tmp, { replace: req.query.replace === '1' });
    // A new trial: last trial's vote counts go, and every device signs in again with its new PIN.
    resetVotes();
    getIo()?.disconnectSockets(true);
    console.log(`  Loaded ${manifest.case.caseNumber} from Court Admin: ${exhibitCount} exhibits, ${seatCount} seats.`);
    res.json({ caseNumber: manifest.case.caseNumber, exhibitCount, seatCount });
  } catch (err) {
    if (err instanceof ImportError) throw new HttpError(err.code === 'leftover' ? 409 : 400, `The jury server didn’t load the case: ${err.message}`);
    throw err;
  } finally {
    busy = false;
    fs.rmSync(tmp, { force: true });
  }
});

export default router;
