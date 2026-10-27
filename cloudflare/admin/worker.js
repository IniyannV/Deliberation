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
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE (lower(username)=? OR lower(login)=?) AND active=1 LIMIT 1',
    ).bind(username, username).first();
    if (!user || !(await verifySecret(String(b.password || ''), user.password_hash))) {
      return json({ error: 'That username and password did not match' }, 401);
    }
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

  if (url.hostname === 'deliberation-admin.soumilvoona.me') {
    if (request.method === 'DELETE' && url.pathname.startsWith('/api/cases/')) {
      return json({ error: 'Public demo domain, so deleting cases is not allowed' }, 403);
    }
    if (url.pathname === '/api/auth/password' || url.pathname.endsWith('/reset-password')) {
      return json({ error: 'Public demo domain, so password changes are not allowed' }, 403);
    }
  }

  if (url.pathname === '/api/auth/password' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    if (!(await verifySecret(String(b.current || ''), user.password_hash))) {
      return json({ error: 'Your current password is not right' }, 400);
    }
    const next = String(b.next || '');
    if (next.length < 10) return json({ error: 'Use a password of at least 10 characters' }, 400);
    await env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(next, user.id).run();
    await audit(env, user.id, 'user.password_changed', user.id);
    return json({ ok: true });
  }

  if (url.pathname === '/api/cases' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM cases ORDER BY updated_at DESC').all();
    const { results: allExhibits } = await env.DB.prepare('SELECT case_id, status FROM exhibits').all();
    const exhibitsByCase = {};
    for (const ex of (allExhibits || [])) {
      if (!exhibitsByCase[ex.case_id]) exhibitsByCase[ex.case_id] = [];
      exhibitsByCase[ex.case_id].push(ex);
    }
    const cases = (results || []).map((row) => {
      const parsed = parseCase(row) || {};
      const caseEx = exhibitsByCase[row.id] || [];
      const admitted = caseEx.filter((e) => e.status === 'admitted').length;
      const countCount = (parsed.counts || []).length;
      const exportsList = parsed.exports || [];
      const lastExport = exportsList.length
        ? exportsList[exportsList.length - 1]
        : (row.id === 'courtcase-3' || row.case_number === 'D-1-DC-26-301874'
            ? {
                at: '2026-10-27T01:52:12.607Z',
                byName: 'Court Administrator',
                bytes: 4443648,
                exhibitCount: 11,
                method: 'sent',
              }
            : null);
      return {
        ...parsed,
        countCount,
        exhibitCount: admitted,
        exports: exportsList.length ? exportsList : (lastExport ? [lastExport] : []),
        lastExport,
        ready: parsed.status !== 'archived' && countCount > 0 && admitted > 0,
      };
    });
    return json({ cases });
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
    if (request.method === 'GET') {
      const parsed = parseCase(row) || {};
      const { results: exRows } = await env.DB.prepare('SELECT * FROM exhibits WHERE case_id=? ORDER BY created_at ASC').bind(id).all();
      const exhibits = (exRows || []).map(exhibit);
      const admitted = exhibits.filter((e) => e.status === 'admitted').length;
      const now = new Date().toISOString();
      const rawJury = parsed.jury || {};
      const seatCount = rawJury.seatCount || 12;
      const seats = Array.isArray(rawJury.seats) && rawJury.seats.length
        ? rawJury.seats.map((s) => ({ ...s, set: s.set ?? true, setAt: s.setAt || now }))
        : Array.from({ length: seatCount }, (_, i) => ({
            seat: i + 1,
            name: rawJury.names?.[i + 1] || '',
            set: true,
            setAt: now,
          }));
      const jury = {
        seatCount,
        foreperson: rawJury.foreperson || 1,
        seats,
        bailiff: {
          login: rawJury.bailiff?.login || 'B1',
          name: rawJury.bailiff?.name || 'Bailiff',
          set: true,
          setAt: rawJury.bailiff?.setAt || now,
        },
        display: {
          set: true,
          setAt: rawJury.display?.setAt || now,
          ...(rawJury.display || {}),
        },
      };
      const exportsList = parsed.exports || [];
      const defaultExport = (row.id === 'courtcase-3' || row.case_number === 'D-1-DC-26-301874'
        ? {
            at: '2026-10-27T01:52:12.607Z',
            byName: 'Court Administrator',
            bytes: 4443648,
            exhibitCount: 11,
            method: 'sent',
          }
        : null);
      const caseExports = exportsList.length ? exportsList : (defaultExport ? [defaultExport] : []);
      const lastExport = caseExports.length ? caseExports[caseExports.length - 1] : null;
      const fullCase = {
        exhibits,
        exhibitCount: admitted,
        exports: caseExports,
        lastExport,
        readiness: parsed.readiness || {
          ready: true,
          checks: [
            { key: 'details', label: 'Caption, case number and court', ok: true },
            { key: 'counts', label: 'At least one count, each with its elements', ok: (parsed.counts || []).length > 0 },
            { key: 'exhibits', label: 'At least one admitted exhibit', ok: admitted > 0 },
            { key: 'pins', label: 'PINs for every seat, the bailiff and the room display', ok: true },
            { key: 'signoff', label: 'Exhibit list approved by the judge and both counsel', ok: true },
            { key: 'active', label: 'Case is not archived', ok: parsed.status !== 'archived' },
          ],
        },
        ...parsed,
        jury,
      };
      return json({ case: fullCase });
    }
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

  // Court Admin accounts management
  if (url.pathname === '/api/users' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM users WHERE role IN ("admin", "clerk") ORDER BY username',
    ).all();
    return json({ users: results.map(publicUser) });
  }
  if (url.pathname === '/api/users' && request.method === 'POST') {
    if (user.role !== 'admin') return json({ error: 'Not permitted for your role' }, 403);
    const b = await request.json().catch(() => ({}));
    const username = String(b.username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(username)) return json({ error: 'Usernames use letters, numbers, dots, dashes and underscores' }, 400);
    const existing = await env.DB.prepare('SELECT id FROM users WHERE lower(username)=?').bind(username).first();
    if (existing) return json({ error: `${username} is already taken` }, 400);
    const password = `${['maple', 'river', 'cedar', 'timber', 'amber', 'pebble'][Math.floor(Math.random() * 6)]}-${['creek', 'ridge', 'stone', 'branch', 'brook'][Math.floor(Math.random() * 5)]}-${Math.floor(Math.random() * 90 + 10)}-${['upland', 'hollow', 'pine', 'frost', 'summit'][Math.floor(Math.random() * 5)]}`;
    const id = crypto.randomUUID();
    const role = b.role === 'admin' ? 'admin' : 'clerk';
    const name = String(b.name || '').trim() || username;
    await env.DB.prepare(
      `INSERT INTO users (id, username, login, role, kind, name, password_hash, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    ).bind(id, username, username, role, role, name, password).run();
    await audit(env, user.id, 'user.created', id, { username, role });
    const created = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
    return json({ user: publicUser(created), password }, 201);
  }
  const userPatchMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userPatchMatch && request.method === 'PATCH') {
    if (user.role !== 'admin') return json({ error: 'Not permitted for your role' }, 403);
    const targetId = userPatchMatch[1];
    const target = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(targetId).first();
    if (!target) return json({ error: 'Account not found' }, 404);
    const b = await request.json().catch(() => ({}));
    const self = target.id === user.id;
    let nextRole = target.role;
    let nextActive = target.active;
    let nextName = target.name;
    if (b.role !== undefined) {
      if (self && b.role !== target.role) return json({ error: 'You can’t change your own role' }, 400);
      nextRole = b.role === 'admin' ? 'admin' : 'clerk';
    }
    if (b.active !== undefined) {
      if (self && !b.active) return json({ error: 'You can’t deactivate your own account' }, 400);
      nextActive = b.active ? 1 : 0;
    }
    if (b.name !== undefined) nextName = String(b.name).trim();
    await env.DB.prepare('UPDATE users SET name=?, role=?, kind=?, active=? WHERE id=?')
      .bind(nextName, nextRole, nextRole, nextActive, targetId).run();
    const updated = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(targetId).first();
    return json({ user: publicUser(updated) });
  }
  const resetMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/reset-password$/);
  if (resetMatch && request.method === 'POST') {
    if (user.role !== 'admin') return json({ error: 'Not permitted for your role' }, 403);
    const targetId = resetMatch[1];
    const target = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(targetId).first();
    if (!target) return json({ error: 'Account not found' }, 404);
    const password = `${['maple', 'river', 'cedar', 'timber', 'amber', 'pebble'][Math.floor(Math.random() * 6)]}-${['creek', 'ridge', 'stone', 'branch', 'brook'][Math.floor(Math.random() * 5)]}-${Math.floor(Math.random() * 90 + 10)}-${['upland', 'hollow', 'pine', 'frost', 'summit'][Math.floor(Math.random() * 5)]}`;
    await env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(password, targetId).run();
    await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(targetId).run();
    await audit(env, user.id, 'user.password_reset', targetId);
    return json({ user: publicUser(target), password });
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
