# Deliberation modernization assessment

## Scope and detected project type

- Repository: `/Users/soumil/Desktop/Deliberation`
- Detected language/runtime: JavaScript/TypeScript ecosystem (ES modules, React/Vite, Node.js); no Java or .NET build manifests found.
- Assessment mode: repository inspection plus `npm-check-updates@19.6.3` on all four workspace manifests.
- Requested target: two native Cloudflare Workers (Jury and Court Admin), D1, R2, Durable Objects/WebSockets, no Containers, while preserving `npm run demo`.

## Current architecture (evidence)

1. **Two independent Node/Express applications.** `server/index.js` starts the jury API and Socket.IO server; `court-admin/server/index.js` starts the court-admin API. Both use `express`, `cookie-parser`, `multer`, and lowdb.
2. **File-backed persistence.** `server/db.js` and `court-admin/server/db.js` initialize and save JSON databases (`server/data/db.json` and `court-admin/server/data/db.json`, approximately 48 KB and 56 KB). Routes and services directly mutate the lowdb object and call `save()`.
3. **Realtime coupling to Socket.IO.** `server/realtime.js`, `server/sockets/index.js`, `server/sockets/deliberation.js`, and `client/src/store/live.js` use Socket.IO rooms/events. The admin server has no equivalent native Worker transport.
4. **Exhibit uploads are local filesystem operations.** `server/routes/exhibits.js`, `server/lib/exhibits.js`, and multer use local paths; exhibit/PDF assets are served by Express. R2 object keys and signed/authorized retrieval do not exist.
5. **Current Cloudflare deployment is Container-based, not native Workers.** `cloudflare/jury/worker.js` and `cloudflare/admin/worker.js` import `@cloudflare/containers` and forward every request to a named Container. Both Wrangler files declare `[[containers]]`, Container Durable Object bindings, and SQLite container storage. The Dockerfiles install Node dependencies, seed lowdb, and launch Express.
6. **Frontend same-origin assumptions.** `client/src/lib/api.js` and `court-admin/client/src/lib/api.js` call `/api`; `client/src/store/live.js` creates a Socket.IO connection. These can remain same-origin behind each Worker, but transport and authentication semantics must change.
7. **Local demo is an explicit compatibility requirement.** `scripts/demo.js` seeds both JSON stores, builds bundles, starts the two Node servers on ports 4000/4100, and prints role credentials/URLs. This should remain a separate local adapter rather than be removed while Worker handlers are introduced.

## Foundational migration changes

### 1. Establish a shared domain/storage boundary

Extract route-independent case, deliberation, voting, requests, audit, auth, and exhibit operations from `server/routes/*`, `server/services/*`, and `court-admin/server/routes/*` into modules with async repository interfaces. Implement:

- D1 repositories and migrations for case metadata, users/roles, jurors, exhibits, notes, timeline, requests, votes/results, and audit events.
- A local repository backed by the existing lowdb JSON files for `npm run demo`.
- Explicit transaction/idempotency handling for vote submission, request state transitions, and audit writes.

Do not make D1 calls directly from React or duplicate business rules between the two Workers.

### 2. Replace Container forwarding with native Worker entrypoints

Create separate Worker handlers for Jury and Court Admin, routing the existing `/api/*` contracts and static assets. Remove `@cloudflare/containers`, `[[containers]]`, Docker deployment paths, and container-specific seed-at-start behavior from the production path. Keep Node entrypoints/scripts only for local demo and import/seed tooling.

### 3. Design realtime around Durable Objects

Use a room Durable Object (likely one object per case/deliberation) to own WebSocket sessions, presence, broadcast ordering, and reconnect behavior. Persist authoritative state/events in D1; use the DO for fan-out and short-lived connection state. Replace Socket.IO-specific namespaces, rooms, acknowledgements, and event names in `server/sockets/*`, `server/realtime.js`, and `client/src/store/live.js` with a documented WebSocket protocol. Verify Cloudflare WebSocket upgrade handling, hibernation/reconnect, authorization, and multi-tab behavior.

### 4. Move exhibits to R2

Define an R2 key scheme and D1 metadata table (case, exhibit id, filename, content type, size, checksum, visibility, uploader, created time). Stream multipart uploads in the Worker, enforce size/type/auth limits, and return authorized R2 reads or short-lived access URLs. Preserve PDF.js client behavior while changing URLs away from local filesystem paths. Existing import scripts need an R2-compatible upload mode plus a local filesystem mode.

### 5. Rework authentication and cross-Worker trust

Current cookie/session behavior is implemented in `server/auth.js`, `court-admin/server/auth.js`, and route middleware. Define Worker-compatible signed/encrypted session cookies, secure attributes, expiration/rotation, CSRF policy for cookie-authenticated mutations, and an explicit admin-to-jury service authorization model. Do not rely on the current hard-coded `JURY_SERVER_URL` in `cloudflare/admin/worker.js`; use Worker service bindings or a signed internal request where appropriate.

### 6. Preserve local behavior through an adapter

Keep `npm run demo`, `demo:reset`, `demo:dev`, seed scripts, and port/credential output working against Node/lowdb. Add contract tests that exercise the same API and realtime protocol against the local adapter and Worker/miniflare-compatible bindings. Avoid importing Node-only `fs`, `http`, `os`, `path`, or Express modules into Worker bundles.

## Risks and constraints

- **D1 is not lowdb.** Existing synchronous in-memory mutations and whole-file saves must become async SQL with schema migrations, indexes, transactions, and conflict handling; concurrent juror writes are a correctness risk.
- **Realtime correctness is high risk.** Socket.IO currently supplies room membership, reconnect behavior, event framing, and acknowledgements. A naïve WebSocket rewrite can lose events or leak case data across rooms.
- **R2 changes consistency and delivery semantics.** Upload completion, metadata atomicity, range/PDF reads, and cleanup on failed D1 writes need an explicit saga/reconciliation strategy.
- **Cloudflare Free limits must be validated.** Confirm current account limits for D1, R2, Durable Objects, Worker CPU/request duration, WebSocket usage, object size, and egress before committing to traffic/retention assumptions.
- **Security boundary expands.** The current closed-LAN premise is weaker on a public Worker deployment. Audit logs, brute-force protection, cookie/session secrets, CORS/origin checks, upload validation, and least-privilege bindings become release blockers.
- **Seed/import behavior is currently startup-driven.** Container commands run seed on every start. Native Workers must use explicit migrations/seed commands and environment-specific data bindings; never seed production from a request handler.
- **PDF/static asset size and bundling need measurement.** PDF.js assets are copied by client prebuild scripts; Worker static serving should be handled by the Workers asset configuration, not Node filesystem reads.
- **Dependency drift is not the migration itself.** `npm-check-updates` found only `multer` minor updates on both servers; React/Vite/ESLint toolchain updates are available but should be isolated from the platform rewrite.

## Exact implementation opportunities / recommended planning slices

1. Freeze current HTTP, auth, upload, vote, audit, and Socket.IO behavior with contract and demo smoke tests.
2. Inventory all route payloads and lowdb collections; author a normalized D1 schema and migration/seed plan.
3. Introduce repository interfaces and local lowdb implementation without changing `npm run demo`.
4. Implement D1 repository and Worker-compatible domain services; migrate jury API routes first.
5. Implement R2 exhibit storage and import compatibility; update exhibit API/client URLs.
6. Implement Durable Object WebSocket protocol and adapt `client/src/store/live.js`; test reconnect, authorization, ordering, and multi-case isolation.
7. Implement Court Admin Worker and service-to-jury integration; migrate admin auth/users/catalog/audit routes.
8. Configure native Wrangler bindings (D1, R2, DO, assets, secrets), remove Container bindings/Docker deployment, and add preview/local binding configuration.
9. Run parity, concurrency, upload, security, and free-tier-limit validation; only then cut production traffic.

## Dependency assessment

`npm-check-updates@19.6.3` results:

- Root: `concurrently` has a major update available (`9.1.2` → `10.0.6`).
- Jury client: React/Vite/ESLint major updates are available; `zustand`, React types, and `pdfjs-dist` have compatible updates.
- Court Admin client: same React/Vite/ESLint toolchain drift; compatible `zustand`, React, and `pdfjs-dist` updates.
- Jury and Court Admin servers: only `multer` minor update (`2.4.0` → `2.5.0`).

No dependency updates were applied. `express`, `socket.io`, `socket.io-client`, `lowdb`, and `@cloudflare/containers` are architectural migration targets, not routine update tasks.

## Assessment conclusion

The repository already has a useful two-frontend/two-backend separation and a local demo harness, but the deployed path is currently two Container-wrapped Express processes with filesystem state. The migration is therefore a foundational backend/runtime rewrite, not a Wrangler configuration change. The safest plan is to preserve the existing Node adapters and API behavior while incrementally replacing persistence, exhibit storage, and realtime behind shared domain contracts, then switch each Worker from Container forwarding to native bindings. The highest-priority gates are D1 concurrency/schema correctness, WebSocket authorization/order/reconnect behavior, R2 upload/read security, and proof that `npm run demo` remains unchanged.
