import { Router } from 'express';
import { db, save } from '../db.js';
import { ROLES, destroyUserSessions, hashPassword, publicUser, randomPassword, requireRole } from '../auth.js';
import { auditAs } from '../services/audit.js';
import { HttpError, bad, newId, nowIso, oneOf, str } from '../lib/shared.js';

/* Court office accounts. Admins only. New and reset passwords are shown once. */

const router = Router();
router.use(requireRole(ROLES.ADMIN));

const findUser = (id) => {
  const u = db.data.users.find((x) => x.id === id);
  if (!u) throw new HttpError(404, 'Account not found');
  return u;
};

router.get('/', (_req, res) => {
  res.json({ users: db.data.users.map(publicUser).sort((a, b) => a.username.localeCompare(b.username)) });
});

router.post('/', async (req, res) => {
  const username = str(req.body?.username, { min: 2, max: 32, field: 'Username' }).toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(username)) throw bad('Usernames use letters, numbers, dots, dashes and underscores');
  if (db.data.users.some((u) => u.username === username)) throw bad(`${username} is already taken`);
  const password = randomPassword();
  const user = {
    id: newId('usr'),
    username,
    name: str(req.body?.name, { min: 1, max: 80, field: 'Name' }),
    role: oneOf(req.body?.role, ['admin', 'clerk'], 'Role'),
    active: true,
    createdAt: nowIso(),
    ...hashPassword(password),
  };
  db.data.users.push(user);
  await save();
  auditAs(req.user, 'user.created', user.id, { username, role: user.role });
  res.status(201).json({ user: publicUser(user), password });
});

router.patch('/:id', async (req, res) => {
  const u = findUser(req.params.id);
  const { name, role, active } = req.body ?? {};
  // Admins can't demote or deactivate themselves, so there is always at least one active admin.
  const self = u.id === req.user.id;
  // Check everything before changing anything.
  const nextName = name !== undefined ? str(name, { min: 1, max: 80, field: 'Name' }) : u.name;
  const nextRole = role !== undefined ? oneOf(role, ['admin', 'clerk'], 'Role') : u.role;
  const nextActive = typeof active === 'boolean' ? active : u.active !== false;
  if (self && nextRole !== u.role) throw bad('You can’t change your own role');
  if (self && !nextActive) throw bad('You can’t deactivate your own account');

  u.name = nextName;
  if (nextRole !== u.role) {
    u.role = nextRole;
    auditAs(req.user, 'user.role_set', u.id, { username: u.username, role: u.role });
  }
  if (nextActive !== (u.active !== false)) {
    u.active = nextActive;
    if (!nextActive) await destroyUserSessions(u.id);
    auditAs(req.user, 'user.active_set', u.id, { username: u.username, active: nextActive });
  }
  await save();
  res.json({ user: publicUser(u) });
});

router.post('/:id/reset-password', async (req, res) => {
  const u = findUser(req.params.id);
  const password = randomPassword();
  Object.assign(u, hashPassword(password));
  await destroyUserSessions(u.id);
  auditAs(req.user, 'user.password_reset', u.id, { username: u.username });
  res.json({ user: publicUser(u), password });
});

export default router;
