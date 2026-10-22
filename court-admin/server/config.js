import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const PORT = Number(process.env.PORT) || 4100;
// Court office computers on the same network can reach it. Set HOST=127.0.0.1 to keep it to this machine.
export const HOST = process.env.HOST || '0.0.0.0';
export const IS_PROD = process.env.NODE_ENV === 'production';

export const DATA_DIR = path.join(here, 'data');
export const DB_FILE = path.join(DATA_DIR, 'db.json');
export const AUDIT_FILE = path.join(DATA_DIR, 'audit.log.jsonl');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const CLIENT_DIST = path.join(here, '..', 'client', 'dist');

export const SESSION_COOKIE = 'ca_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // one office day
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // room for trial video

// The jury server on this machine, which "Send to jury iPads" loads the case into.
export const JURY_SERVER_URL = process.env.JURY_SERVER_URL || 'http://127.0.0.1:4000';

// The case package format. scripts/import-case.js in the jury server accepts this version.
export const PACKAGE_FORMAT = 'jurycase/1';
