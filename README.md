# Deliberation Room

An offline web app for a sequestered or long-deliberating jury. One laptop runs
the court's local server. Juror devices, the room projector and the bailiff's
station connect to it over a closed LAN with an ordinary browser.

**It never touches the public internet.** There are no CDNs, web fonts,
external APIs, analytics or telemetry, and the server sends a strict
Content-Security-Policy so browsers refuse anything that isn't served by this
laptop.

> Prototype / demo. The case, people and exhibits in the seed data are fictional.

## Quick start

Requires Node 20+. Install once while online (or from an offline npm cache):

```bash
npm install
npm run seed      # fictional case, 12 seats + bailiff + display; prints PINs
npm run build     # builds the client into client/dist
npm start         # serves everything on port 4000 and prints the LAN URLs
```

On startup the server prints addresses such as `http://192.168.4.43:4000`.
Open that address on each juror device, the projector and the bailiff station.

| Script | What it does |
|---|---|
| `npm run dev` | Express API on :4000 plus Vite on :5173 (hot reload, proxied API/sockets). The strict CSP is enforced in `npm start`, not on the Vite dev server. |
| `npm run build` | Production build of the client (`client/dist`) |
| `npm start` | Production: one port, serves `client/dist`, REST API and socket.io, bound to `0.0.0.0` |
| `npm run seed` | **Stop the server first.** Rebuilds `server/data/db.json`, regenerates demo exhibits and placeholder audio, prints new PINs. The previous audit log is archived, never deleted. |

Set `PORT` to change the port (`PORT=8080 npm start`).

## Who signs in where

| Role | Sign in with | Lands on |
|---|---|---|
| Juror | seat number (1–12) + PIN | `/juror`: evidence, timeline, voting, requests, messages, wellbeing |
| Foreperson | their seat number + PIN | same as juror, plus poll/ballot controls, judge questions, room-display control |
| Room display | `DISPLAY` + PIN | `/display`: full-screen projector view (read-only) |
| Bailiff / Clerk | `B1` + PIN | `/admin`: request queue, evidence upload, seats & PINs, family updates, menu, audit log |

The clerk can reset PINs, reassign the foreperson and excuse seats from
**Admin → Juror seats**. PINs are stored only as salted scrypt hashes.

Roles are enforced **on the server** for every REST route and every socket
event (`requireRole` in `server/auth.js`; the per-event role table in
`server/sockets/deliberation.js`). Hiding UI is never the only protection.

## Loading a real case

1. `npm run seed` to create seats, staff accounts and PINs. Edit
   `server/scripts/lib/case-content.js` first to set the caption, case number
   and counts (charges) for ballots.
2. In **Admin → Evidence**, remove the demo exhibits and upload the admitted
   exhibits: PDF, PNG/JPEG/WebP/GIF, or `.txt` transcripts. Transcript lines
   that start with `Q:`, `A:` or `NAME:` become speaker turns. Files are
   type-checked by content, and SVG/HTML are refused.
3. Configure the meal menu and supplies in **Admin → Menu & supplies**.
4. Drop licensed audio into `server/media/` (see below).

## Audiobooks and music

The wellbeing hub plays every audio file in **`server/media/`**. `npm run seed`
only creates short generated placeholder tones. **No copyrighted audio is
included.** To add licensed audiobooks or music, copy `.mp3/.m4a/.ogg/.wav/.flac`
files into `server/media/` and optionally describe them in
`server/media/catalog.json`. See `server/media/README.md` for details.
Calming noise (white, pink, brown, rain) is generated in the browser with the
Web Audio API and needs no files.

## Privacy design

- **Secret ballots and polls.** The server records *that* a seat voted
  separately from *what* was chosen, and never stores the two together. Open
  vote state lives only in memory, and only the final tally is written to disk.
  See the comment at the top of `server/services/voting.js`. Restarting the
  server mid-ballot voids that ballot, so it must be re-run.
- **Audit log** (`server/data/audit.log.jsonl`): append-only and hash-chained, so
  edits are detected and shown in the admin UI. Exportable as CSV. It records
  logins, requests and status changes, family updates and evidence changes, with
  actor and ISO timestamp. It never records deliberation content: no timeline
  text, poll or ballot activity, judge-question text or message bodies. `meta`
  fields pass through an allowlist.
- **Family updates** are one-way: text-only, one seat each, logged with the
  bailiff ID. Jurors can mark them read. No reply UI or endpoint exists.
- Court staff see only whether a device is connected, never deliberation activity.

## Offline guarantees

- CSP header from Express:
  `default-src 'self'; connect-src 'self' ws: ; img-src 'self' blob: data:; font-src 'self'`
- Fonts (Atkinson Hyperlegible, SIL OFL) are self-hosted in `client/src/assets/fonts`.
- The pdf.js worker is bundled by Vite. Character maps, standard fonts and
  decoders are copied into `client/public/pdfjs` at build time.
- No `http(s)://` URLs are used at runtime by `client/src`, `client/index.html`
  or `server`. The only matches are the startup banner that prints LAN
  addresses and the font licence text. URL strings inside the built bundle come
  from library internals (XML namespaces, error-message links) and are never
  fetched.

## Project layout

```
client/                 React + Vite (SWC), Tailwind, zustand, react-router
  src/features/         evidence · timeline · voting · requests · bulletin · wellbeing
  src/pages/            login, juror home, display, admin/*
  src/store/            auth, live (socket-synced state), ui (theme, toasts)
server/
  index.js              Express + socket.io on one port, CSP, LAN banner
  auth.js               PIN hashing, sessions (httpOnly cookie), role guards
  routes/               auth, exhibits, media, juror, admin
  sockets/              connection auth + timeline/links/polls/ballots/display
  services/             audit.js (append-only log), voting.js (anonymous voting)
  scripts/seed.js       demo case, generated PDFs/PNGs/WAVs
  data/                 db.json (lowdb), uploads, audit log (git-ignored)
  media/                audio for the wellbeing hub
```
