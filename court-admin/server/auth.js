import crypto from 'node:crypto';
import { db, save } from './db.js';
import { SESSION_COOKIE, SESSION_TTL_MS } from './config.js';
import { HttpError } from '../../server/lib/util.js';

/*
 * Court office accounts. An admin manages accounts; a clerk prepares cases.
 * Both can do everything else. Passwords are salted scrypt hashes.
 */

export const ROLES = { ANY: ['admin', 'clerk'], ADMIN: ['admin'] };

export const roleOf = (user) => (user && user.active !== false ? user.role : null);

export const publicUser = (u) => u && ({ id: u.id, username: u.username, name: u.name, role: u.role, active: u.active !== false });

/* ── Passwords ─────────────────────────────────────────────────────── */

export function hashPassword(password) {
  const passSalt = crypto.randomBytes(16).toString('hex');
  const passHash = crypto.scryptSync(String(password), passSalt, 64).toString('hex');
  return { passSalt, passHash };
}

export function verifyPassword(user, password) {
  if (!user?.passHash) return false;
  const a = Buffer.from(user.passHash, 'hex');
  const b = crypto.scryptSync(String(password), user.passSalt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function checkPasswordRules(password) {
  const p = String(password ?? '');
  if (p.length < 10) throw new HttpError(400, 'Use a password of at least 10 characters');
  if (p.length > 200) throw new HttpError(400, 'That password is too long');
  return p;
}

/** A readable random password for new accounts and resets, e.g. "maple-river-42-stone". */
export function randomPassword() {
  const words = ['amber', 'birch', 'cedar', 'delta', 'ember', 'falcon', 'granite', 'harbor', 'island', 'juniper', 'kestrel', 'lantern', 'maple', 'north', 'orchard', 'pebble', 'quartz', 'river', 'summit', 'timber', 'upland', 'valley', 'willow', 'yarrow'];
  const pick = () => words[crypto.randomInt(words.length)];
  return `${pick()}-${pick()}-${crypto.randomInt(10, 100)}-${pick()}`;
}

/* Simple lockout: 5 bad passwords for one username → 60 s wait. */
const failures = new Map();
export function checkThrottle(key) {
  const f = failures.get(key);
  if (f && f.count >= 5 && Date.now() - f.last < 60_000) throw new HttpError(429, 'Too many attempts. Please wait a minute.');
}
export function noteFailure(key) {
  const f = failures.get(key) ?? { count: 0, last: 0 };
  if (Date.now() - f.last > 60_000) f.count = 0;
  failures.set(key, { count: f.count + 1, last: Date.now() });
}
export const clearFailures = (key) => failures.delete(key);

/* ── Sessions ──────────────────────────────────────────────────────── */

const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db.data.sessions = db.data.sessions.filter((s) => s.expiresAt > now);
  db.data.sessions.push({ tokenHash: tokenHash(token), userId, createdAt: now, expiresAt: now + SESSION_TTL_MS });
  await save();
  return token;
}

export function userForToken(token) {
  if (!token) return null;
  const h = tokenHash(token);
  const session = db.data.sessions.find((s) => s.tokenHash === h && s.expiresAt > Date.now());
  if (!session) return null;
  const user = db.data.users.find((u) => u.id === session.userId);
  return roleOf(user) ? user : null;
}

export async function destroySession(token) {
  if (!token) return;
  const h = tokenHash(token);
  db.data.sessions = db.data.sessions.filter((s) => s.tokenHash !== h);
  await save();
}

export async function destroyUserSessions(userId) {
  db.data.sessions = db.data.sessions.filter((s) => s.userId !== userId);
  await save();
}

export const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: false, path: '/', maxAge: SESSION_TTL_MS };

/* ── Express middleware ────────────────────────────────────────────── */

export function authenticate(req, _res, next) {
  const user = userForToken(req.cookies?.[SESSION_COOKIE]);
  req.user = user;
  req.role = roleOf(user);
  next();
}

/** Every protected route declares the roles allowed to call it. */
export function requireRole(...groups) {
  const allowed = new Set(groups.flat());
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in'));
    if (!allowed.has(req.role)) return next(new HttpError(403, 'Not permitted for your role'));
    next();
  };
}
