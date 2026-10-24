# Deliberation

An offline web app for a sequestered or long-deliberating jury. One laptop runs
the court's local server. Juror devices, the room projector and the bailiff's
station connect to it over a closed LAN with an ordinary browser.

**It never touches the public internet.** There are no CDNs, web fonts,
external APIs, analytics or telemetry, and the server sends a strict
Content-Security-Policy so browsers refuse anything that isn't served by this
laptop. The one exception, off unless the court turns it on, is a **YouTube
exhibit**: start the server with `ALLOW_ONLINE_EXHIBITS=1` and the clerk can
add one by link. It plays in YouTube's privacy-enhanced player, only on
devices that can reach the internet.

> Prototype / demo. The case, people and exhibits in the seed data are fictional.

## Quick start

Requires Node 20+. Install dependencies once:

```bash
npm install
npm run demo
```

**`npm run demo` is the single command for judges and reviewers:**
- Seeds the Court Admin office (`http://localhost:4100`) with the mock trial case ready to export.
- Initializes the Jury App (`http://localhost:4000`) in a clean state waiting to receive the trial.
- Starts both servers and prints the credentials and walkthrough steps in the terminal.
- Opens your browser to Court Admin (`http://localhost:4100`), where you review the case and click **"Send to jury iPads"** to push the trial to the jury room!

### All scripts

| Script | What it does |
|---|---|
| `npm run demo` | **Recommended for judging:** builds, seeds if needed, starts both Jury App (:4000) and Court Admin (:4100), prints credentials & opens browser |
| `npm run demo:reset` | Resets and re-seeds both databases with fresh demo data, then launches |
| `npm run demo:dev` | Runs both apps in development mode with Vite hot-reloading |
| `npm run dev` | Express API on :4000 plus Vite on :5173 (jury app only) |
| `npm run build` | Production build of the jury client (`client/dist`) |
| `npm start` | Production jury server on :4000 serving `client/dist` and API |
| `npm run seed` | Rebuilds jury demo case data and prints PINs |
| `npm run admin:dev` | Court Admin API on :4100 plus Vite on :5174 |
| `npm run admin:build` / `admin:start` | Build and serve Court Admin portal on :4100 |
| `npm run admin:seed` | Rebuilds Court Admin demo accounts and cases |

Set `PORT` to change the port (`PORT=8080 npm start`). Set
`ALLOW_ONLINE_EXHIBITS=1` to allow YouTube exhibits (see above); without it
they can't be added, and any already loaded are hidden from jurors and the display.

**Trying the demo?** Sign in as seat `1` (the foreperson), then choose
**Guided tour** in the sidebar. The bailiff (`B1`) has its own tour.

## Who signs in where

| Role | Sign in with | Lands on |
|---|---|---|
| Juror | seat number (1–12) + PIN | `/juror`: evidence, side-by-side review, shared and personal timelines, voting, private notes, requests, read aloud |
| Foreperson | seat `1` in the demo | same as juror, plus poll/ballot controls, judge questions, the "we have a verdict" notice, room-display control |
| Room display | `DISPLAY` + PIN | `/display`: full-screen projector view (read-only) |
| Bailiff / Clerk | `B1` + PIN | `/admin`: request queue and the court's answers, evidence upload, seats & PINs, menu, court controls, audit log |

The clerk can reset PINs, reassign the foreperson, excuse seats and seat
alternates from **Admin → Juror seats**. PINs are stored only as salted scrypt
hashes.

Roles are enforced **on the server** for every REST route and every socket
event (`requireRole` in `server/auth.js`; the per-event role table in
`server/sockets/deliberation.js`). Hiding UI is never the only protection.

## Loading a real case

The recommended way is **Court Admin** (below): prepare the case in the court
office and send it to the jury iPads. To set a case up by hand
on the jury laptop instead:

1. `npm run seed` to create seats, staff accounts and PINs. Edit
   `server/scripts/lib/case-content.js` first to set the caption, case number
   and counts (charges) for ballots.
2. In **Admin → Evidence**, remove the demo exhibits and upload the admitted
   exhibits: PDF, PNG/JPEG/WebP/GIF, `.txt` transcripts, or MP4/MOV/WebM
   video (up to 2 GB). Transcript lines that start with `Q:`, `A:` or
   `NAME:` become speaker turns. Files are type-checked by content, and
   SVG/HTML are refused. A video's frame rate is read from its MP4/MOV
   header so jurors can step through it one frame at a time. With
   `ALLOW_ONLINE_EXHIBITS=1`, **YouTube link** adds a YouTube video instead
   of a file (internet required to play).
3. Configure the meal menu and supplies in **Admin → Menu & supplies**.

Each count's **elements, definitions and burden of proof** (shown to jurors
beside every ballot) live in `case-content.js` too. For a real trial, copy them
from the judge's written instructions.

## Court Admin (court office app)

A separate website in `court-admin/` where clerks prepare trials: cases and
their charges, admitted exhibits, juror seats and PINs, and the menu. It runs
on the same machine as the jury server and sends a ready case straight to
the jurors' iPads.

```bash
npm run admin:seed          # demo: admin + clerk accounts, one ready case, one draft
npm run admin:build
npm run admin:start         # http://localhost:4100 (and the office network address)
```

Sign-ins for the demo are saved to `court-admin/server/data/demo-credentials.txt`
(git-ignored), along with the demo case's jury PINs. For a real office, skip
the seed and create the first admin account instead; it prints a one-time
password:

```bash
npm run admin:create-user -- --username jsmith --name "Jo Smith"
```

**Court Admin and the jury server run on the same machine.** Court Admin
loads a case straight into the running jury server (port 4000, or set
`JURY_SERVER_URL`), so there is no USB drive, signing key or command line
step. The jury server accepts a case only from this machine.

| Script | What it does |
|---|---|
| `npm run admin:dev` | Admin API on :4100 plus Vite on :5174 with hot reload |
| `npm run admin:build` / `admin:start` | Build the website; serve it and the API on :4100 (`PORT`, `HOST` to change) |
| `npm run admin:create-user` | Add an account from the command line (stop the server first) |
| `npm run import-case -- <file> [--replace]` | For a jury laptop that isn't this machine, with its jury server stopped: load a downloaded package |

How a case moves:

1. **Cases → New case**, then fill in the tabs. *Charges*: each count with
   its elements and definitions, copied from the judge's written
   instructions. *Evidence*: upload each admitted exhibit (same file types
   and checks as the jury app; withdrawn exhibits stay on record but aren't
   exported). *Charges* has a **Texas offense** list (common Penal,
   Health and Safety, and Transportation Code offenses, with Irving venue)
   that fills in a count to edit. *Jury & PINs*: seat count, foreperson,
   bailiff ID and, optionally, each juror's name; generate PINs, or tick
   several slips and **Print selected** to print them on one sheet. PINs are
   shown once and stored only as hashes.
2. **Sign-off & send**: record that the judge and both counsel approved the
   exhibit list. Any later exhibit change clears the sign-off. When every
   item on the checklist is done, **Send to jury iPads** loads the case into
   the jury server. It checks the manifest's and every exhibit's SHA-256 and
   each file's real type, and changes nothing if any check fails. If the
   server still holds another trial's deliberations, Court Admin asks before
   replacing them. The old audit log is archived, and every iPad signs in
   again with the new PINs.
3. For a jury laptop that isn't this machine: **Download a copy** and run
   `npm run import-case -- /Volumes/USB/26-CR-0418.jurycase.tar` there with
   its jury server stopped (`--replace` once the court is finished with the
   previous trial).

Court Admin has its own accounts (admins manage accounts; clerks do
everything else), its own hash-chained audit log (**Audit log**), and the
same offline rules as the jury app: a strict CSP and no outside requests.
The package is a plain tar (`manifest.json`, `manifest.sha256`, `exhibits/…`)
that any tar tool can list. The manifest lists every exhibit's SHA-256.

## Using it on an iPad

Jurors are expected to use iPads, so every touch gesture has a mouse twin:

Layouts are tuned for the iPad (10th generation), 820 × 1180 points:

- In **landscape** the sidebar sits beside the page; in **portrait** it slides
  over the page and tucks away again, as in iPadOS apps. Choosing a section
  always puts the sidebar away so the page gets the full width.
- **Add to Home Screen** (Share → Add to Home Screen) runs the app full screen
  without Safari's bars, with its own icon.
- Buttons are at least 44 points on touch screens, and double-tap zoom is off
  so taps respond at once.
- **Long-press** does whatever right-click does (pin a note on a photo, open a
  timeline card's menu).
- **Videos** have their own controls: ⏴| and |⏵ (or ← and → on a keyboard)
  step one frame, Shift+arrows a second, Space plays and pauses.
- **Press and hold** transcript text to select it, then tap **Highlight**.
  Highlights are private to each juror and follow them to any device.
- **A− / A+** in the top-right corner make all text smaller or larger.
- The sidebar collapses (top-left button) to give exhibits the whole width,
  and every exhibit has a **Full screen** button.

## In the courtroom

How the app fits the court's own procedure. The judge decides all of this;
the app only supports it.

- **Before deliberations.** The judge authorizes the devices and tells the
  jury about them in the charge. Both sides confirm that the exhibits on the
  laptop match the admitted exhibit list exactly.
- **Questions for the judge.** The foreperson sends them from **Requests**.
  Once the judge has decided the answer with counsel, the bailiff opens the
  question in the **Request queue** and records **the court's answer**: the
  judge's written answer, or word that it will be given in open court. Every
  juror sees the jury's questions and the answers.
- **Verdict.** When the jury agrees on every count, the foreperson fills in
  and signs the paper verdict form, then taps **We have a verdict** in
  Requests. The bailiff's queue highlights it and chimes even with do not
  disturb on. The app is told only *that* there is a verdict, never what it
  is; the verdict is read and the jury polled in open court as usual.
- **Excusing a juror and seating an alternate.** In **Admin → Juror seats**,
  **Seat an alternate** gives the seat a new PIN for the alternate, who
  starts with nothing from the juror who left (private notes, requests
  and chat). Open polls and ballots are voided whenever the
  jury changes. **Restart deliberations** (on by default; follow the judge's
  instruction) clears the shared timeline, exhibit notes, transcript links
  and every vote, and asks the jury on the room display to begin again. The
  same restart is on the dashboard under **Court controls**.
- **End of each court day.** Use **Court controls → Sign out all** so no
  iPad or the display can be used overnight, then collect the iPads and keep
  them, with the server laptop, in the court officer's custody. Keep the
  jury network closed (no internet uplink) and its Wi-Fi password private.
- **End of trial.** After the verdict, and once the court confirms none of
  it must be kept, **Court controls → Erase permanently** (type the case
  number to confirm) erases the shared and private timelines, notes and
  highlights, every vote, and all chats and request messages. Exhibits, seats, judge questions and answers, and the
  audit log stay. Leave `server/data` out of Time Machine and other backups,
  or erased content survives in old copies.

## Privacy design

- **Secret ballots and polls.** The server records *that* a seat voted
  separately from *what* was chosen, and never stores the two together. Open
  vote state lives only in memory. See the comment at the top of
  `server/services/voting.js`. Restarting the server mid-ballot voids that
  ballot, so it must be re-run. The room display never receives a running
  count for a secret ballot, only the final result.
- **No vote counts on disk.** Courts don't want staff to learn how the jury
  is divided, and `db.json` sits on the clerk's laptop. Closed polls and
  ballots keep their counts in memory only, so jurors see them until the
  server stops. On disk a ballot keeps just its outcome (unanimous Guilty,
  unanimous Not Guilty, or not unanimous), and a poll keeps nothing.
- **Audit log** (`server/data/audit.log.jsonl`): append-only and hash-chained, so
  edits are detected and shown in the admin UI. Exportable as CSV. It records
  logins, requests and status changes and evidence changes, with
  actor and ISO timestamp, shown in plain English. It never records
  deliberation content: no timeline text, image notes, poll or ballot activity,
  judge-question or answer text, or the text of request messages.
  `meta` fields pass through an allowlist.
- **Request messages** are a separate juror ↔ bailiff thread on each request
  (for example, a menu substitution). Only the juror who made the request and
  the bailiff can post to it, and only they can read it, except on the
  jury's notes (judge questions and the verdict notice), which every juror
  can read.
- **Image notes** (right-click a photo) are shared with the jury and never
  visible to court staff.
- **Two timelines.** The shared timeline is edited by every juror and shown on
  the room display. Each juror also has a personal timeline that only their
  own devices receive; events can be copied between the two. Neither is
  visible to court staff or written to the audit log.
- Court staff see only whether a device is connected, never deliberation activity.

## Offline guarantees

- CSP header from Express:
  `default-src 'self'; connect-src 'self' ws: ; img-src 'self' blob: data:; font-src 'self'; frame-src 'self'`
  With `ALLOW_ONLINE_EXHIBITS=1`, `frame-src` also allows
  `https://www.youtube-nocookie.com` for YouTube exhibits; the app still
  loads no script from the internet and drives the player by `postMessage`.
- Text uses the device's own UI font (SF Pro on Apple devices, Segoe UI or Roboto elsewhere), so no font is downloaded.
- The pdf.js worker is bundled by Vite. Character maps, standard fonts and
  decoders are copied into `client/public/pdfjs` at build time.
- No `http(s)://` URLs are used at runtime by `client/src`, `client/index.html`
  or `server`, except YouTube's player address, which is framed only when
  online exhibits are allowed and a juror opens a YouTube exhibit. The other matches are the startup banner that
  prints LAN addresses, the YouTube-link parser and the font licence text. URL strings inside the built bundle come
  from library internals (XML namespaces, error-message links) and are never
  fetched.

## Project layout

```
client/                 React + Vite (SWC), Tailwind, zustand, react-router
  src/features/         evidence (PDF, image, video, transcript viewers) · timeline · voting · requests · notes · tour
  src/pages/            login, juror home, display, admin/*
  src/store/            auth, live (socket-synced state), ui (theme, toasts)
server/
  index.js              Express + socket.io on one port, CSP, LAN banner
  auth.js               PIN hashing, sessions (httpOnly cookie), role guards
  routes/               auth, exhibits, juror, admin, local
  sockets/              connection auth + timeline/links/notes/polls/ballots/display
  services/             audit.js (append-only log), voting.js (anonymous voting)
  scripts/seed.js       demo case, generated PDFs/PNGs, a short demo video
  lib/case-import.js    checks and loads a Court Admin case package
  routes/local.js       lets Court Admin on this machine send a case (localhost only)
  scripts/import-case.js  loads a downloaded case package from the command line
  lib/tar.js            tar writer/reader for case packages (shared with Court Admin)
  data/                 db.json (lowdb), uploads, audit log, demo PINs (git-ignored)
court-admin/
  client/               the office website: cases, charges, evidence, jury & PINs, sign-off & send, accounts, audit
  server/               Express API on :4100, own accounts, db, uploads and audit log; reuses server/lib
```
