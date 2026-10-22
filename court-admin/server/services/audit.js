import crypto from 'node:crypto';
import fs from 'node:fs';
import { AUDIT_FILE } from '../config.js';

/*
 * Append-only audit log, one JSON object per line, hash-chained like the
 * jury app's: each entry carries the SHA-256 of the one before, so editing
 * or removing a line breaks the chain and verifyChain() reports where.
 * `meta` passes through an allowlist.
 */

const META_ALLOWLIST = new Set([
  'username', 'role', 'active', 'caseNumber', 'caption', 'exhibitNumber', 'exhibitType',
  'status', 'countCount', 'seatCount', 'which', 'itemCount', 'bytes', 'fields', 'fingerprint',
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

export function audit({ actor, action, target = null, meta = {} }) {
  const cleanMeta = Object.fromEntries(Object.entries(meta).filter(([k, v]) => META_ALLOWLIST.has(k) && v !== undefined));
  const body = { seq: seq + 1, ts: new Date().toISOString(), actor, action, target, meta: cleanMeta, prevHash: lastHash };
  const entry = { ...body, hash: hashEntry(body) };
  fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n');
  seq = entry.seq;
  lastHash = entry.hash;
  return entry;
}

export const auditAs = (user, action, target, meta) => audit({ actor: user?.id ?? 'anonymous', action, target, meta });

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
  const cols = ['seq', 'ts', 'actorName', 'summary', 'actor', 'action', 'target', 'meta', 'prevHash', 'hash'];
  return [cols.join(','), ...entries.map((e) => cols.map((c) => csvCell(e[c])).join(','))].join('\n') + '\n';
}
