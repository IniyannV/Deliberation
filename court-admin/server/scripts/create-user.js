/*
 * Create a court office account from the command line, e.g. the first admin:
 *
 *   npm run admin:create-user -- --username jsmith --name "Jo Smith" [--role clerk]
 *
 * Prints a generated password once. The person can change it after signing in.
 * Safe to run while the server is stopped; stop it first so it doesn't
 * overwrite the new account with its in-memory copy.
 */
import { parseArgs } from 'node:util';
import net from 'node:net';
import { PORT } from '../config.js';
import { db, initDb } from '../db.js';
import { hashPassword, randomPassword } from '../auth.js';
import { audit, initAudit } from '../services/audit.js';
import { newId, nowIso } from '../lib/shared.js';

const { values } = parseArgs({
  options: { username: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', default: 'admin' } },
});

const fail = (msg) => { console.error(`\n  ${msg}\n`); process.exit(1); };
const username = values.username?.trim().toLowerCase();
if (!username || !/^[a-z0-9._-]{2,32}$/.test(username)) {
  fail('Usage: npm run admin:create-user -- --username jsmith --name "Jo Smith" [--role admin|clerk]');
}
if (!['admin', 'clerk'].includes(values.role)) fail('--role must be admin or clerk');

const serverUp = await new Promise((resolve) => {
  const socket = net.connect(PORT, '127.0.0.1').once('connect', () => { socket.destroy(); resolve(true); }).once('error', () => resolve(false));
});
if (serverUp) fail(`The Court Admin server is running on port ${PORT}. Stop it first, or add the account from Users in the app.`);

await initDb();
initAudit();
if (db.data.users.some((u) => u.username === username)) fail(`“${username}” already exists.`);

const password = randomPassword();
const user = { id: newId('usr'), username, name: values.name?.trim() || username, role: values.role, active: true, createdAt: nowIso(), ...hashPassword(password) };
db.data.users.push(user);
await db.write();
audit({ actor: 'system', action: 'user.created', target: user.id, meta: { username, role: user.role } });

console.log(`\n  Created ${user.role} “${username}” (${user.name})`);
console.log(`  Password: ${password}`);
console.log('  It is shown only now. Change it after signing in.\n');
