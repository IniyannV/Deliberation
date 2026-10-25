import { Router } from 'express';
import { db } from '../db.js';
import { SESSION_COOKIE } from '../config.js';
import {
  checkThrottle, clearFailures, cookieOptions, createSession, destroySession, findUserByIdentifier,
  noteFailure, publicUser, roleOf, verifyPin,
} from '../auth.js';
import { audit, auditAs } from '../services/audit.js';
import { HttpError } from '../lib/util.js';

const router = Router();

router.post('/login', async (req, res) => {
  const identifier = String(req.body?.identifier ?? '').trim().slice(0, 80);
  const pin = String(req.body?.pin ?? '').slice(0, 32);
  checkThrottle(identifier.toLowerCase());
  const user = findUserByIdentifier(identifier);
  if (!user || !roleOf(user) || !verifyPin(user, pin)) {
    noteFailure(identifier.toLowerCase());
    audit({ actor: 'anonymous', role: 'none', action: 'auth.login_failed', meta: { identifier } });
    throw new HttpError(401, 'That seat number and PIN did not match');
  }
  clearFailures(identifier.toLowerCase());
  const token = await createSession(user.id);
  res.cookie(SESSION_COOKIE, token, cookieOptions);
  auditAs(user, roleOf(user), 'auth.login', user.id, user.seat ? { seat: user.seat } : {});
  const userCase = (Array.isArray(db.data.cases) && user.caseNumber
    ? db.data.cases.find((c) => c.caseNumber?.toLowerCase() === user.caseNumber?.toLowerCase())
    : null) || db.data.case;
  res.json({ user: publicUser(user), case: userCase });
});

router.post('/logout', async (req, res) => {
  if (req.user) auditAs(req.user, req.role, 'auth.logout', req.user.id);
  await destroySession(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  const userCase = (Array.isArray(db.data.cases) && req.user.caseNumber
    ? db.data.cases.find((c) => c.caseNumber?.toLowerCase() === req.user.caseNumber?.toLowerCase())
    : null) || db.data.case;
  res.json({ user: publicUser(req.user), case: userCase });
});

export default router;
