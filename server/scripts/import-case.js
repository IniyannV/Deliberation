/*
 * Load a case package exported by Court Admin onto this jury laptop:
 *
 *   npm run import-case -- <file.jurycase.tar> [--replace]
 *
 * Stop the jury server first. (When Court Admin runs on this same machine,
 * its "Send to jury iPads" button does this while the server is running.)
 * Nothing changes unless every check passes; see lib/case-import.js. If
 * this laptop still holds deliberation work from another trial, the import
 * stops unless --replace is given.
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { PORT } from '../config.js';
import { initDb } from '../db.js';
import { initAudit } from '../services/audit.js';
import { ImportError, importCase } from '../lib/case-import.js';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { replace: { type: 'boolean', default: false } } });
const fail = (msg) => { console.error(`\n  Import stopped: ${msg}\n  Nothing on this laptop was changed.\n`); process.exit(1); };

const file = positionals[0];
if (!file) fail('Name the package file: npm run import-case -- /Volumes/USB/26-CR-0418.jurycase.tar');
if (!fs.existsSync(file)) fail(`${file} does not exist.`);

const serverUp = await new Promise((resolve) => {
  const socket = net.connect(PORT, '127.0.0.1').once('connect', () => { socket.destroy(); resolve(true); }).once('error', () => resolve(false));
});
if (serverUp) fail(`the jury server is running on port ${PORT}. Stop it first, or use “Send to jury iPads” in Court Admin.`);

await initDb();
initAudit();

let result;
try {
  result = await importCase(file, { replace: values.replace, onProgress: (msg) => console.log(`\n  ${msg}`) });
} catch (err) {
  if (!(err instanceof ImportError)) throw err;
  fail(err.code === 'leftover' ? `${err.message} If it is, run the import again with --replace.` : err.message);
}

const { manifest, archived, exhibitCount, seatCount } = result;
const { case: kase, jury } = manifest;
console.log(`\n  ${kase.caption} (${kase.caseNumber}), exported ${manifest.exportedAt} by ${manifest.exportedBy}`);
if (manifest.signoff) console.log(`  Exhibit list approved ${manifest.signoff.date}: ${manifest.signoff.judge}; ${manifest.signoff.prosecution}; ${manifest.signoff.defense}`);
if (archived) console.log(`  Archived the previous audit log → ${path.basename(archived)}`);
console.log(`\n  Imported ${kase.caseNumber}: ${kase.counts.length} counts, ${exhibitCount} exhibits, ${seatCount} seats.`);
console.log(`  Jurors sign in with seat numbers 1–${seatCount}; the bailiff with ${jury.bailiff.login}; the projector with DISPLAY.`);
console.log('  Use the PINs on the printed PIN sheet from Court Admin.\n');
console.log('  Start the jury server with: npm start\n');
