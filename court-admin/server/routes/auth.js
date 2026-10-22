import { Router } from 'express';
import { db, save } from '../db.js';
import { SESSION_COOKIE } from '../config.js';
import {
  checkPasswordRules, checkThrottle, clearFailures, cookieOptions, createSession, destroySession, hashPassword,
  noteFailure, publicUser, requireRole, roleOf, ROLES, verifyPassword,
} from '../auth.js';
import { audit, auditAs } from '../services/audit.js';
import { HttpError } from '../lib/shared.js';

const router = Router();

router.post('/login', async (req, res) => {
  const username = String(req.body?.username ?? '').trim().toLowerCase().slice(0, 64);
  const password = String(req.body?.password ?? '').slice(0, 200);
  checkThrottle(username);
  const user = db.data.users.find((u) => u.username === username);
  if (!user || !roleOf(user) || !verifyPassword(user, password)) {
    noteFailure(username);
    audit({ actor: 'anonymous', action: 'auth.login_failed', meta: { username } });
    throw new HttpError(401, 'That username and password did not match');
  }
  clearFailures(username);
  res.cookie(SESSION_COOKIE, await createSession(user.id), cookieOptions);
  auditAs(user, 'auth.login', user.id);
  res.json({ user: publicUser(user) });
});

router.post('/logout', async (req, res) => {
  if (req.user) auditAs(req.user, 'auth.logout', req.user.id);
  await destroySession(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/password', requireRole(ROLES.ANY), async (req, res) => {
  if (!verifyPassword(req.user, String(req.body?.current ?? ''))) throw new HttpError(400, 'Your current password is not right');
  Object.assign(req.user, hashPassword(checkPasswordRules(req.body?.next)));
  await save();
  auditAs(req.user, 'user.password_changed', req.user.id);
  res.json({ ok: true });
});

export default router;
