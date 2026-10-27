import {
  audit, caseForUser, clearSession, createSession, destroySession, json, parseCase,
  publicUser, requireUser, sessionUser, verifySecret, withSession,
} from '../shared.js';

function rowExhibit(row) {
  return {
    id: row.id, caseId: row.case_id, number: row.number, title: row.title,
    party: row.party, description: row.description, type: row.type,
    status: row.status, file: row.r2_key ? { stored: row.r2_key, mime: row.content_type, size: row.size, originalName: row.filename } : null,
    youtubeId: row.youtube_id || undefined,
    lines: row.lines_json ? JSON.parse(row.lines_json) : null,
    uploadedAt: row.created_at,
  };
}

async function auth(request, env, pathname) {
  if (pathname === '/api/auth/login' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const identifier = String(body.identifier || '').trim();
    const pin = String(body.pin || '');
    if (/^\d{1,2}$/.test(identifier)) {
      const activeCase = (await caseForUser(env))?.caseNumber || 'D-1-DC-26-301874';
      return json({ error: `Please enter your case number before your seat (e.g. ${activeCase}-${identifier}) because multiple court cases run simultaneously.` }, 401);
    }
    const user = await env.DB.prepare(
      `SELECT * FROM users WHERE (
         lower(login) = lower(?) OR
         lower(username) = lower(?) OR
         lower(case_number || '-' || seat) = lower(?) OR
         lower(case_number || '-' || login) = lower(?)
       ) AND active=1 LIMIT 1`,
    ).bind(identifier, identifier, identifier, identifier).first();
    if (!user || !(await verifySecret(pin, user.password_hash))) {
      return json({ error: 'That sign-in ID and PIN did not match' }, 401);
    }
    const token = await createSession(env, user.id);
    await audit(env, user.id, 'auth.login', user.id);
    return withSession(json({ user: publicUser(user), case: await caseForUser(env, user) }), token);
  }
  if (pathname === '/api/auth/logout' && request.method === 'POST') {
    await destroySession(request, env);
    return clearSession(json({ ok: true }));
  }
  if (pathname === '/api/auth/me' && request.method === 'GET') {
    const user = await sessionUser(request, env);
    return json({ user: publicUser(user), case: await caseForUser(env, user) });
  }
}

async function api(request, env) {
  const url = new URL(request.url);
  const authResponse = await auth(request, env, url.pathname);
  if (authResponse) return authResponse;
  if (url.pathname === '/api/health') return json({ ok: true, service: 'jury' });
  const access = await requireUser(request, env, ['juror', 'foreperson', 'bailiff', 'display']);
  if (access.response) return access.response;
  const { user } = access;

  if (url.pathname === '/api/cases' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM cases ORDER BY created_at DESC').all();
    return json({ cases: results.map(parseCase) });
  }
  if (url.pathname === '/api/exhibits' && request.method === 'GET') {
    const caseRow = await caseForUser(env, user);
    const { results } = await env.DB.prepare('SELECT * FROM exhibits WHERE case_id=? ORDER BY number').bind(caseRow?.id || '').all();
    return json({ exhibits: results.map(rowExhibit) });
  }
  const exhibitMatch = url.pathname.match(/^\/api\/exhibits\/([^/]+)(?:\/file)?$/);
  if (exhibitMatch) {
    const id = exhibitMatch[1];
    const row = await env.DB.prepare('SELECT * FROM exhibits WHERE id=?').bind(id).first();
    if (!row) return json({ error: 'Exhibit not found' }, 404);
    if (url.pathname.endsWith('/file')) {
      const object = await env.EXHIBITS?.get(row.r2_key);
      if (!object) return json({ error: 'This exhibit’s file is missing. Upload it again.' }, 404);
      const headers = new Headers({ 'content-type': row.content_type, 'content-disposition': 'inline', 'cache-control': 'private, max-age=300' });
      object.writeHttpMetadata(headers);
      return new Response(object.body, { headers });
    }
    return json({ exhibit: { ...rowExhibit(row), lines: row.lines_json ? JSON.parse(row.lines_json) : null } });
  }
  if (url.pathname === '/api/exhibits' && request.method === 'POST') {
    if (user.role !== 'bailiff') return json({ error: 'Not permitted for your role' }, 403);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return json({ error: 'file is required' }, 400);
    if (file.size > 50 * 1024 * 1024) return json({ error: 'File is too large' }, 413);
    const caseRow = await caseForUser(env, user);
    if (!caseRow) return json({ error: 'No active case' }, 409);
    const key = `exhibits/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await env.EXHIBITS.put(key, file.stream(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } });
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO exhibits (id,case_id,r2_key,filename,content_type,size,number,title,party,description,type,uploader_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(id, caseRow.id, key, file.name, file.type || 'application/octet-stream', file.size,
      form.get('number') || id.slice(0, 8), form.get('title') || file.name, form.get('party') || 'other',
      form.get('description') || '', file.type?.startsWith('video/') ? 'video' : 'document', user.id).run();
    await audit(env, user.id, 'exhibit.uploaded', id, { key });
    return json({ exhibit: rowExhibit(await env.DB.prepare('SELECT * FROM exhibits WHERE id=?').bind(id).first()) }, 201);
  }

  // Bailiff station endpoints
  if (url.pathname === '/api/admin/overview' && request.method === 'GET') {
    if (user.role !== 'bailiff') return json({ error: 'Not permitted' }, 403);
    const caseRow = await caseForUser(env, user);
    const exCount = await env.DB.prepare('SELECT count(*) as count FROM exhibits WHERE case_id=?').bind(caseRow?.id || '').first();
    return json({
      case: caseRow,
      pendingRequests: 0,
      exhibits: exCount?.count || 0,
      presence: {},
      onlineExhibits: false,
    });
  }
  if (url.pathname === '/api/admin/seats' && request.method === 'GET') {
    if (user.role !== 'bailiff') return json({ error: 'Not permitted' }, 403);
    const caseRow = await caseForUser(env, user);
    const { results } = await env.DB.prepare(
      'SELECT id, seat, role, active FROM users WHERE (kind="juror" OR role IN ("juror","foreperson")) AND case_number=? ORDER BY seat',
    ).bind(caseRow?.caseNumber || 'D-1-DC-26-301874').all();
    return json({ seats: results.map((r) => ({ id: r.id, seat: r.seat, isForeperson: r.role === 'foreperson', active: r.active !== 0 })) });
  }
  const resetPinMatch = url.pathname.match(/^\/api\/admin\/seats\/([^/]+)\/reset-pin$/);
  if (resetPinMatch && request.method === 'POST') {
    if (user.role !== 'bailiff') return json({ error: 'Not permitted' }, 403);
    const seatId = resetPinMatch[1];
    const target = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(seatId).first();
    if (!target) return json({ error: 'Seat not found' }, 404);
    const pin = String(Math.floor(Math.random() * 900000 + 100000));
    await env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(pin, seatId).run();
    await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(seatId).run();
    await audit(env, user.id, 'seat.pin_reset', seatId, { seat: target.seat });
    return json({ seat: { id: target.id, seat: target.seat, isForeperson: target.role === 'foreperson', active: target.active !== 0 }, pin });
  }
  const seatPatchMatch = url.pathname.match(/^\/api\/admin\/seats\/([^/]+)$/);
  if (seatPatchMatch && request.method === 'PATCH') {
    if (user.role !== 'bailiff') return json({ error: 'Not permitted' }, 403);
    const seatId = seatPatchMatch[1];
    const target = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(seatId).first();
    if (!target) return json({ error: 'Seat not found' }, 404);
    const b = await request.json().catch(() => ({}));
    if (b.isForeperson === true) {
      await env.DB.prepare('UPDATE users SET role="juror" WHERE role="foreperson" AND case_number=?').bind(target.case_number).run();
      await env.DB.prepare('UPDATE users SET role="foreperson" WHERE id=?').bind(seatId).run();
    }
    if (typeof b.active === 'boolean') {
      await env.DB.prepare('UPDATE users SET active=? WHERE id=?').bind(b.active ? 1 : 0, seatId).run();
      if (!b.active) await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(seatId).run();
    }
    const updated = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(seatId).first();
    return json({ seat: { id: updated.id, seat: updated.seat, isForeperson: updated.role === 'foreperson', active: updated.active !== 0 } });
  }

  return json({ error: 'not_found' }, 404);
}

export class CaseRoom {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket upgrade required', { status: 426 });
    const pair = new WebSocketPair();
    const [client, socket] = Object.values(pair);
    this.state.acceptWebSocket(socket);
    socket.send(JSON.stringify({ type: 'ready', protocol: 1 }));
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(socket, message) {
    let event; try { event = JSON.parse(message); } catch { socket.send(JSON.stringify({ type: 'error', code: 'invalid_json' })); return; }
    if (event.requestId) socket.send(JSON.stringify({ type: 'ack', replyTo: event.requestId, ok: true }));
    const payload = JSON.stringify({ type: event.type, payload: event.payload ?? {}, serverTime: new Date().toISOString() });
    for (const peer of this.state.getWebSockets()) if (peer !== socket) peer.send(payload);
  }
  webSocketClose(socket) { try { socket.close(); } catch {} }
  webSocketError(socket) { try { socket.close(1011, 'socket error'); } catch {} }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const id = env.CASE_ROOM.idFromName(url.searchParams.get('caseId') || 'default');
      return env.CASE_ROOM.get(id).fetch(request);
    }
    if (url.pathname.startsWith('/api/')) return api(request, env);
    // Vite's output is served by the Worker asset binding.  Falling back to
    // index.html keeps React Router routes working on a direct request.
    const asset = await env.ASSETS.fetch(request);
    return asset.status === 404
      ? env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request))
      : asset;
  },
};
