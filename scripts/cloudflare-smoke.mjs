const juryBase = process.env.JURY_WORKER_URL || process.env.WORKER_URL || 'http://127.0.0.1:8787';
const adminBase = process.env.ADMIN_WORKER_URL || 'http://127.0.0.1:8788';
const identifier = process.env.WORKER_IDENTIFIER || 'juror1';
const pin = process.env.WORKER_PIN || '1234';
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin-password';
if (!juryBase || !adminBase) {
  console.error('Set JURY_WORKER_URL and ADMIN_WORKER_URL when using non-default ports.');
  process.exit(2);
}

function client(base) {
  const jar = new Map();
  return async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const setCookie = response.headers.getSetCookie?.() || [];
  for (const value of setCookie) jar.set(value.split('=', 1)[0], value.split(';', 1)[0].split('=').slice(1).join('='));
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${response.status} ${body.error || ''}`);
  return body;
  };
}

async function assertFrontend(base, label) {
  const response = await fetch(`${base}/`);
  const body = await response.text();
  if (!response.ok || !body.includes('<div id="root">')) throw new Error(`${label} did not serve built index.html (${response.status})`);
}

await assertFrontend(juryBase, 'jury');
await assertFrontend(adminBase, 'admin');

const request = client(juryBase);
const login = await request('/api/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier, pin }),
});
if (!login.user) throw new Error('login did not return user');
const me = await request('/api/auth/me');
if (me.user?.id !== login.user.id) throw new Error('/me did not preserve session');
const cases = await request('/api/cases');
if (!Array.isArray(cases.cases)) throw new Error('case listing missing');
const exhibits = await request('/api/exhibits');
if (!Array.isArray(exhibits.exhibits)) throw new Error('exhibit listing missing');
await request('/api/auth/logout', { method: 'POST' });

const adminRequest = client(adminBase);
const adminLogin = await adminRequest('/api/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: adminUsername, password: adminPassword }),
});
if (adminLogin.user?.role !== 'admin') throw new Error('admin login did not return an admin user');
const adminCases = await adminRequest('/api/cases');
if (!Array.isArray(adminCases.cases)) throw new Error('admin case listing missing');
await adminRequest('/api/auth/logout', { method: 'POST' });
console.log(`ok: jury index.html, admin index.html, jury login/me (${cases.cases.length} cases, ${exhibits.exhibits.length} exhibits), admin login/cases (${adminCases.cases.length}), logout`);
