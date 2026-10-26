# Modernization Plan: Native Cloudflare Workers Migration

**Project**: Deliberation

## Technical Framework

- **Language**: JavaScript (ES modules), Node.js local runtime
- **Framework**: Express 5 local adapters; React/Vite clients
- **Build Tool**: npm workspaces, Vite, Wrangler
- **Database**: lowdb JSON files locally; target Cloudflare D1
- **Key Dependencies**: Socket.IO, lowdb, multer, PDF.js, Durable Objects,
  R2, D1, Cloudflare Workers

## Overview

This migration replaces the deployed Express/Socket.IO/container path with two
native Cloudflare Workers while preserving the existing local demo experience.
The Jury and Court Admin applications will share domain contracts and use
structured D1 data, R2 exhibit objects, and Durable Objects WebSockets. The
Node/Express/lowdb adapter remains the supported local compatibility path, so
`npm run demo`, `demo:reset`, and `demo:dev` continue to work.

The work is deliberately staged: freeze observable behavior first, introduce
the storage/domain boundary, migrate the Jury Worker, then exhibits and
realtime, migrate Court Admin and cross-Worker trust, and finally run security,
parity, concurrency, upload, and free-tier validation before cutover.

## Migration Impact Summary

| Application | Original Service | New Azure Service | Authentication | Comments |
|---|---|---|---|---|
| Jury | Express, lowdb, Socket.IO | Native Worker, D1, R2, DO | Signed Worker sessions | Preserve `/api` and local adapter |
| Court Admin | Express, lowdb, local files | Native Worker, D1, R2, DO | Signed sessions and service trust | Replace hard-coded jury URL |
| Realtime | Socket.IO rooms/events | Durable Object WebSockets | Case-scoped authorization | Preserve ordering/reconnect semantics |
| Exhibits | multer and local filesystem | R2 plus D1 metadata | Authorized reads/writes | Preserve PDF.js behavior |

## Scope and Constraints

- Two Workers only: Jury and Court Admin.
- Use Cloudflare Free-compatible native Workers, D1, R2, and Durable Objects.
- Do not add Containers or retain container forwarding in production.
- Keep local Express/lowdb behavior and all existing demo commands.
- Do not seed production from a request handler; use explicit migrations/imports.
- Keep business rules out of React and avoid duplicated rules in the Workers.
- Validate current account quotas/limits before production traffic.

## Validation and Release Gates

The implementation must prove HTTP/auth/upload/vote/audit parity, WebSocket
authorization/order/reconnect and multi-tab behavior, R2/D1 consistency and
cleanup, concurrent vote correctness, and that no Node-only modules enter Worker
bundles. `npm run demo` is a required regression gate. Free-tier limits,
secrets, origin/CSRF controls, upload limits, audit behavior, and service
bindings are release blockers.

## Exact Remaining Gaps and Handling

- **D1 schema and concurrency**: inventory every lowdb collection and payload,
  normalize schema/indexes, use migrations and transactions, and define
  idempotency for votes, request transitions, and audit writes.
- **Realtime protocol**: document replacements for Socket.IO rooms,
  acknowledgements, reconnects, and event names; test case isolation and
  ordering through a room Durable Object.
- **R2 saga behavior**: define key/metadata ownership, stream and validate
  uploads, authorize reads, and reconcile orphaned objects or failed metadata
  writes.
- **Authentication/trust**: define signed/encrypted cookie rotation, secure
  attributes, expiry, CSRF/origin policy, and a signed or service-binding
  admin-to-jury request model.
- **Assets and imports**: move static serving to Worker assets and add both
  R2-compatible and local filesystem import modes without changing the demo.
- **Operational limits**: record verified D1, R2, Durable Object, CPU,
  WebSocket, object-size, and egress limits in release evidence; stop before
  cutover if assumptions do not fit the Free plan.
- **Dependency drift**: do not mix routine React/Vite/concurrently/multer
  upgrades into this platform rewrite; reassess separately after parity.

## Open Questions & Questionnaire

- [x] Q: Should the migration use Containers? → A: No; native Workers only.
- [x] Q: Must local behavior remain available? → A: Yes; preserve
  `npm run demo` and lowdb/Express behavior.
- [x] Q: Which persistence and realtime services are required? → A: D1,
  R2, and Durable Objects/WebSockets.
- [x] Q: Is integration/validation in scope? → A: Yes; parity, concurrency,
  upload, security, and free-tier validation are required before cutover.
- [ ] Region, production domain, and account-specific quota values remain to
  be confirmed during environment validation.

