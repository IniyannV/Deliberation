import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_DATA = path.join(ROOT_DIR, 'server', 'data');
const serverDb = JSON.parse(fs.readFileSync(path.join(SERVER_DATA, 'db.json'), 'utf8'));

console.log('Syncing exhibits to Cloudflare R2 (deliberation-exhibits)...');

for (const ex of serverDb.exhibits) {
  const filePath = path.join(SERVER_DATA, 'uploads', 'exhibits', ex.file.stored);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    continue;
  }
  const r2Key = `deliberation-exhibits/exhibits/${ex.file.stored}`;
  console.log(`Uploading ${ex.number} (${ex.file.originalName}) -> ${r2Key}...`);
  execFileSync('npx', ['wrangler', 'r2', 'object', 'put', r2Key, '--file', filePath, '--content-type', ex.file.mime, '--remote'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });
}

console.log('All exhibits synced to R2.');
