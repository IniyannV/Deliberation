import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const PORT = Number(process.env.PORT) || 4000;
// Bind to every interface so juror devices on the courthouse LAN can connect.
export const HOST = process.env.HOST || '0.0.0.0';
export const IS_PROD = process.env.NODE_ENV === 'production';

export const DATA_DIR = path.join(here, 'data');
export const DB_FILE = path.join(DATA_DIR, 'db.json');
export const AUDIT_FILE = path.join(DATA_DIR, 'audit.log.jsonl');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads', 'exhibits');
export const CLIENT_DIST = path.join(here, '..', 'client', 'dist');

export const SESSION_COOKIE = 'dr_session';
export const SESSION_TTL_MS = 16 * 60 * 60 * 1000; // one long court day
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
