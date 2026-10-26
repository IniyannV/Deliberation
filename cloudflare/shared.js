const text = (value) => new TextEncoder().encode(value);

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function cookies(request) {
  return Object.fromEntries((request.headers.get('Cookie') || '').split(';').map((part) => {
    const i = part.indexOf('=');
    return i < 0 ? null : [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
  }).filter(Boolean));
}

export function cookie(name, value, maxAge = 60 * 60 * 24 * 7) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
}

export async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', text(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifySecret(secret, encoded) {
  if (!encoded) return false;
  if (encoded.startsWith('sha256:')) {
    const [, salt, hash] = encoded.split(':');
    return hash === await digest(`${salt}:${secret}`);
  }
  // Useful for development fixtures, never recommended for production.
  return encoded === secret;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    kind: user.kind || user.role,
    role: user.role,
    seat: user.seat == null ? null : Number(user.seat),
    login: user.login || user.username || null,
    name: user.name || (user.seat ? `Juror ${user.seat}` : null),
    caseNumber: user.case_number || user.caseNumber || null,
  };
}

export async function sessionUser(request, env) {
  const token = cookies(request).deliberation_session;
  if (!token || !env.DB) return null;
  const row = await env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=? AND s.expires_at > datetime('now')`,
  ).bind(await digest(token)).first();
  return row || null;
}

export async function requireUser(request, env, roles = []) {
  const user = await sessionUser(request, env);
  if (!user) return { response: json({ error: 'Please sign in' }, 401) };
  if (roles.length && !roles.includes(user.role)) return { response: json({ error: 'Not permitted for your role' }, 403) };
  return { user };
}

export async function createSession(env, userId) {
  const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  await env.DB.prepare(
    `INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,datetime('now','+7 days'))`,
  ).bind(await digest(token), userId).run();
  return token;
}

export async function destroySession(request, env) {
  const token = cookies(request).deliberation_session;
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
}

export function withSession(response, token, maxAge = 60 * 60 * 24 * 7) {
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', cookie('deliberation_session', token, maxAge));
  return new Response(response.body, { status: response.status, headers });
}

export function clearSession(response) {
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', cookie('deliberation_session', '', 0));
  return new Response(response.body, { status: response.status, headers });
}

export async function caseForUser(env, user) {
  const row = user?.case_number
    ? await env.DB.prepare('SELECT * FROM cases WHERE case_number=? LIMIT 1').bind(user.case_number).first()
    : await env.DB.prepare('SELECT * FROM cases ORDER BY created_at DESC LIMIT 1').first();
  return row ? parseCase(row) : null;
}

export function parseCase(row) {
  if (!row) return null;
  try { return row.data_json ? { ...row, ...JSON.parse(row.data_json) } : row; } catch { return row; }
}

export async function audit(env, actorId, action, entityId = null, payload = {}) {
  if (!env.DB) return;
  await env.DB.prepare(
    `INSERT INTO audit_events (id,actor_id,action,entity_type,entity_id,payload_json)
     VALUES (lower(hex(randomblob(16))),?,?,?,?,?)`,
  ).bind(actorId, action, 'api', entityId, JSON.stringify(payload)).run();
}
