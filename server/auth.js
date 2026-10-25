import crypto from 'node:crypto';
import { db, save } from './db.js';
import { SESSION_COOKIE, SESSION_TTL_MS } from './config.js';
import { HttpError } from './lib/util.js';

/* ── Roles ─────────────────────────────────────────────────────────── */

// Groups used by route/socket guards. A foreperson is a juror with extra powers.
export const ROLES = {
  JUROR: ['juror', 'foreperson'],
  FOREPERSON: ['foreperson'],
  BAILIFF: ['bailiff'],
  DISPLAY: ['display'],
};

export function roleOf(user) {
  if (!user || user.active === false) return null;
  if (user.kind === 'juror') return user.isForeperson ? 'foreperson' : 'juror';
  return user.kind; // 'bailiff' | 'display'
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    kind: user.kind,
    role: roleOf(user),
    seat: user.seat ?? null,
    login: user.login ?? null,
    name: user.kind === 'juror' ? user.name || `Juror ${user.seat}` : user.name,
  };
}

/* ── PINs ──────────────────────────────────────────────────────────── */

export function hashPin(pin) {
  const pinSalt = crypto.randomBytes(16).toString('hex');
  const pinHash = crypto.scryptSync(String(pin), pinSalt, 32).toString('hex');
  return { pinSalt, pinHash };
}

export function verifyPin(user, pin) {
  if (!user?.pinHash) return false;
  const a = Buffer.from(user.pinHash, 'hex');
  const b = crypto.scryptSync(String(pin), user.pinSalt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const randomPin = (digits = 6) =>
  String(crypto.randomInt(0, 10 ** digits)).padStart(digits, '0');

/** Jurors sign in with case prefix (e.g. 26-CR-0418-1 or 1); staff and display with case prefix or raw login. */
export function findUserByIdentifier(identifier) {
  const id = String(identifier ?? '').trim();
  const cases = Array.isArray(db.data.cases) ? db.data.cases : (db.data.case?.caseNumber ? [db.data.case] : []);

  for (const c of cases) {
    if (!c?.caseNumber) continue;
    const prefix = c.caseNumber.toLowerCase() + '-';
    if (id.toLowerCase().startsWith(prefix)) {
      const rest = id.slice(prefix.length).trim();
      if (/^\d{1,2}$/.test(rest)) {
        const seatNum = Number(rest);
        const match = db.data.users.find((u) => (!u.caseNumber || u.caseNumber.toLowerCase() === c.caseNumber.toLowerCase()) && u.kind === 'juror' && u.seat === seatNum);
        if (match) return match;
      }
      const matchStaff = db.data.users.find((u) => (!u.caseNumber || u.caseNumber.toLowerCase() === c.caseNumber.toLowerCase()) && u.login && u.login.toLowerCase() === rest.toLowerCase());
      if (matchStaff) return matchStaff;
    }
  }

  // Fallback for raw seat number or bare login ID
  if (/^\d{1,2}$/.test(id)) return db.data.users.find((u) => u.kind === 'juror' && u.seat === Number(id));
  return db.data.users.find((u) => u.login && u.login.toLowerCase() === id.toLowerCase());
}

/* Simple lockout: 5 bad PINs for one identifier → 60 s wait. */
const failures = new Map();
export function checkThrottle(identifier) {
  const f = failures.get(identifier);
  if (f && f.count >= 5 && Date.now() - f.last < 60_000) throw new HttpError(429, 'Too many attempts. Please wait a minute.');
}
export function noteFailure(identifier) {
  const f = failures.get(identifier) ?? { count: 0, last: 0 };
  if (Date.now() - f.last > 60_000) f.count = 0;
  failures.set(identifier, { count: f.count + 1, last: Date.now() });
}
export const clearFailures = (identifier) => failures.delete(identifier);

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

export function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((p) => p.trim()).filter(Boolean).map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))];
    }),
  );
}

/* ── Express middleware ────────────────────────────────────────────── */

export function authenticate(req, _res, next) {
  const user = userForToken(req.cookies?.[SESSION_COOKIE]);
  req.user = user;
  req.role = roleOf(user);
  next();
}

/** Every protected route declares the role groups allowed to call it. */
export function requireRole(...groups) {
  const allowed = new Set(groups.flat());
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in'));
    if (!allowed.has(req.role)) return next(new HttpError(403, 'Not permitted for your role'));
    next();
  };
}
