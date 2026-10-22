import crypto from 'node:crypto';
import fs from 'node:fs';
import { AUDIT_FILE } from '../config.js';

/*
 * Append-only audit log, one JSON object per line.
 *
 * - Entries are only ever appended (fs.appendFileSync); nothing in the app
 *   rewrites or deletes this file.
 * - Each entry carries the SHA-256 of the previous entry, so editing or
 *   removing a line breaks the chain and `verifyChain()` reports it.
 * - It records WHO did WHAT KIND of thing and WHEN, never deliberation
 *   content: no timeline text, poll/ballot activity, notes or judge
 *   questions. `meta` is filtered through an allowlist so
 *   content can't slip in by accident.
 */

const META_ALLOWLIST = new Set([
  'requestType', 'status', 'fromStatus', 'exhibitNumber', 'exhibitType',
  'seat', 'identifier', 'reason', 'itemCount', 'minutes', 'active', 'isForeperson',
  'answerMode', 'restarted', 'signedOut', 'fingerprint',
]);

let seq = 0;
let lastHash = 'GENESIS';

const hashEntry = (entry) => crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex');

export function initAudit() {
  if (!fs.existsSync(AUDIT_FILE)) return;
  const lines = fs.readFileSync(AUDIT_FILE, 'utf8').trim().split('\n').filter(Boolean);
  if (!lines.length) return;
  const last = JSON.parse(lines.at(-1));
  seq = last.seq;
  lastHash = last.hash;
}

/** Start a new chain, once the old log has been archived (a new trial loaded). */
export function resetAudit() {
  seq = 0;
  lastHash = 'GENESIS';
}

export function audit({ actor, role, action, target = null, meta = {} }) {
  const cleanMeta = Object.fromEntries(Object.entries(meta).filter(([k]) => META_ALLOWLIST.has(k)));
  const body = { seq: seq + 1, ts: new Date().toISOString(), actor, role, action, target, meta: cleanMeta, prevHash: lastHash };
  const entry = { ...body, hash: hashEntry(body) };
  fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n');
  seq = entry.seq;
  lastHash = entry.hash;
  return entry;
}

/** Audit helper bound to an authenticated user. */
export const auditAs = (user, role, action, target, meta) =>
  audit({ actor: user?.id ?? 'anonymous', role: role ?? 'none', action, target, meta });

export function readAudit() {
  if (!fs.existsSync(AUDIT_FILE)) return [];
  return fs.readFileSync(AUDIT_FILE, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

export function verifyChain(entries = readAudit()) {
  let prev = 'GENESIS';
  for (const e of entries) {
    const { hash, ...body } = e;
    if (body.prevHash !== prev || hashEntry(body) !== hash) return { ok: false, brokenAt: e.seq, count: entries.length };
    prev = hash;
  }
  return { ok: true, count: entries.length };
}

const csvCell = (v) => {
  let s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t]/.test(s)) s = `'${s}`; // never let a spreadsheet treat a cell as a formula
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(entries) {
  // `summary` and `actorName` are computed for readability; the hash covers only the stored fields.
  const cols = ['seq', 'ts', 'actorName', 'summary', 'actor', 'role', 'action', 'target', 'meta', 'prevHash', 'hash'];
  return [cols.join(','), ...entries.map((e) => cols.map((c) => csvCell(e[c])).join(','))].join('\n') + '\n';
}
