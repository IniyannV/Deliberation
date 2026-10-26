import {
  audit, caseForUser, clearSession, createSession, destroySession, json, parseCase,
  publicUser, requireUser, sessionUser, verifySecret, withSession,
} from '../shared.js';

const exhibit = (r) => ({
  id: r.id, caseId: r.case_id, number: r.number, title: r.title, party: r.party,
  description: r.description, type: r.type, status: r.status,
  file: { stored: r.r2_key, mime: r.content_type, size: r.size, originalName: r.filename },
  uploadedAt: r.created_at,
});

async function auth(request, env, path) {
  if (path === '/api/auth/login' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const username = String(b.username || '').trim().toLowerCase();
    const user = await env.DB.prepare('SELECT * FROM users WHERE lower(username)=? AND active=1 LIMIT 1').bind(username).first();
    if (!user || !(await verifySecret(String(b.password || ''), user.password_hash))) return json({ error: 'That username and password did not match' }, 401);
    const token = await createSession(env, user.id);
    return withSession(json({ user: publicUser(user) }), token);
  }
  if (path === '/api/auth/logout' && request.method === 'POST') {
    await destroySession(request, env); return clearSession(json({ ok: true }));
  }
  if (path === '/api/auth/me') {
    const user = await sessionUser(request, env); return json({ user: publicUser(user) });
  }
}

async function api(request, env) {
  const url = new URL(request.url);
  const authResponse = await auth(request, env, url.pathname);
  if (authResponse) return authResponse;
  if (url.pathname === '/api/health') return json({ ok: true, service: 'court-admin' });
  const access = await requireUser(request, env, ['admin', 'clerk', 'bailiff']);
  if (access.response) return access.response;
  const { user } = access;

  if (url.pathname === '/api/cases' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM cases ORDER BY updated_at DESC').all();
    return json({ cases: results.map(parseCase) });
  }
  if (url.pathname === '/api/cases' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    if (!b.caseNumber || !b.caption) return json({ error: 'Case number and caption are required' }, 400);
    const id = crypto.randomUUID();
    const data = { ...b, id, caseNumber: b.caseNumber, caption: b.caption, status: 'active', counts: [], jury: { seats: [] } };
    await env.DB.prepare('INSERT INTO cases (id,case_number,title,status,data_json) VALUES (?,?,?,?,?)')
      .bind(id, b.caseNumber, b.caption, 'active', JSON.stringify(data)).run();
    return json({ case: data }, 201);
  }
  const caseMatch = url.pathname.match(/^\/api\/cases\/([^/]+)$/);
  if (caseMatch) {
    const id = caseMatch[1];
    const row = await env.DB.prepare('SELECT * FROM cases WHERE id=?').bind(id).first();
    if (!row) return json({ error: 'Case not found' }, 404);
    if (request.method === 'GET') return json({ case: parseCase(row) });
    if (request.method === 'PATCH') {
      const b = await request.json().catch(() => ({}));
      const data = { ...parseCase(row), ...b, id };
      await env.DB.prepare('UPDATE cases SET case_number=?, title=?, status=?, data_json=?, updated_at=datetime("now") WHERE id=?')
        .bind(data.caseNumber || row.case_number, data.caption || data.title || row.title, data.status || row.status, JSON.stringify(data), id).run();
      return json({ case: data });
    }
  }
  const caseExhibits = url.pathname.match(/^\/api\/cases\/([^/]+)\/exhibits$/);
  if (caseExhibits && request.method === 'POST') {
    if (user.role !== 'admin' && user.role !== 'clerk') return json({ error: 'Not permitted for your role' }, 403);
    const caseId = caseExhibits[1]; const form = await request.formData(); const file = form.get('file');
    if (!(file instanceof File)) return json({ error: 'Choose a file to upload' }, 400);
    const key = `exhibits/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await env.EXHIBITS.put(key, file.stream(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } });
    const id = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO exhibits (id,case_id,r2_key,filename,content_type,size,number,title,party,description,type,uploader_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, caseId, key, file.name, file.type || 'application/octet-stream', file.size,
      form.get('number') || id.slice(0, 8), form.get('title') || file.name, form.get('party') || 'other', form.get('description') || '',
      file.type?.startsWith('video/') ? 'video' : 'document', user.id).run();
    return json({ exhibit: exhibit(await env.DB.prepare('SELECT * FROM exhibits WHERE id=?').bind(id).first()) }, 201);
  }
  const exMatch = url.pathname.match(/^\/api\/cases\/exhibits\/([^/]+)(?:\/file)?$/);
  if (exMatch) {
    const row = await env.DB.prepare('SELECT * FROM exhibits WHERE id=?').bind(exMatch[1]).first();
    if (!row) return json({ error: 'Exhibit not found' }, 404);
    if (url.pathname.endsWith('/file')) {
      const object = await env.EXHIBITS?.get(row.r2_key);
      if (!object) return json({ error: 'This exhibit’s file is missing. Upload it again.' }, 404);
      const h = new Headers({ 'content-type': row.content_type, 'content-disposition': url.searchParams.has('download') ? 'attachment' : 'inline', 'cache-control': 'private, max-age=300' });
      object.writeHttpMetadata(h); return new Response(object.body, { headers: h });
    }
    return json({ exhibit: exhibit(row) });
  }
  if (url.pathname === '/api/users' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY username').all();
    return json({ users: results.map(publicUser) });
  }
  if (url.pathname === '/api/audit') {
    const { results } = await env.DB.prepare('SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 500').all();
    return json({ events: results });
  }
  if (url.pathname === '/api/jury/health' && env.JURY) return fetch(new Request(`${env.JURY.url}/api/health`, request));
  return json({ error: 'not_found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return api(request, env);
    const asset = await env.ASSETS.fetch(request);
    return asset.status === 404
      ? env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request))
      : asset;
  },
};
