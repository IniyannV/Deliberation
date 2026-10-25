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

---

## Quick start

Requires Node 20+. Install dependencies once:

```bash
npm install
npm run demo
```

**`npm run demo` is the single command for judges and reviewers:**
- **Seeds the Texas criminal trial (*The State of Texas v. Cody Ray Brennan*) straight into the Juror iPads (`http://localhost:4000`)** with 10 admitted exhibits, 19 interactive timeline events, statutory charge elements, and full voting/request systems ready immediately.
- Seeds the Court Admin office portal (`http://localhost:4100`) with administrative accounts and ready trials.
- Starts both servers and prints direct URLs and sign-in credentials in the terminal.
- Opens your browser directly to the **Jury App (`http://localhost:4000`)** ready to sign in!

---

## Demo Credentials & Passwords

All credentials are deterministic and ready to use immediately across both ports.

### 1. Juror iPads & Jury Room Station (Port 4000)

Access URL: **`http://localhost:4000`** (or `http://<LAN-IP>:4000` on iPads)

| Role | Sign-in ID | 6-Digit PIN | Lands On / Capabilities |
|---|---|---|---|
| **Foreperson (Seat 1)** | `D-1-DC-26-301874-1` | **`863462`** | `/juror`: Lead juror. All juror evidence/notes tools + poll & ballot controls, question judge, "we have a verdict", room projector controls, guided tour |
| **Juror Seat 2** | `D-1-DC-26-301874-2` | **`377793`** | `/juror`: Evidence locker, split review, timeline, private notes & highlights, secret ballot voting, requests |
| **Juror Seat 3** | `D-1-DC-26-301874-3` | **`606667`** | `/juror`: Full juror deliberation suite |
| **Juror Seat 4** | `D-1-DC-26-301874-4` | **`060801`** | `/juror`: Full juror deliberation suite |
| **Juror Seat 5** | `D-1-DC-26-301874-5` | **`356725`** | `/juror`: Full juror deliberation suite |
| **Juror Seat 6** | `D-1-DC-26-301874-6` | **`438289`** | `/juror`: Full juror deliberation suite |
| **Juror Seat 7** | `D-1-DC-26-301874-7` | **`177224`** | `/juror`: Full juror deliberation suite |
| **Juror Seat 8** | `D-1-DC-26-301874-8` | **`105733`** | `/juror`: Full juror deliberation suite |
| **Juror Seat 9** | `D-1-DC-26-301874-9` | **`109656`** | `/juror`: Full juror deliberation suite |
| **Juror Seat 10** | `D-1-DC-26-301874-10` | **`403991`** | `/juror`: Full juror deliberation suite |
| **Juror Seat 11** | `D-1-DC-26-301874-11` | **`494894`** | `/juror`: Full juror deliberation suite |
| **Juror Seat 12** | `D-1-DC-26-301874-12` | **`181719`** | `/juror`: Full juror deliberation suite |
| **Bailiff / Clerk** | `D-1-DC-26-301874-B1` | **`906447`** | `/admin`: Request queue & official answers, exhibit management, juror seat PIN resets & alternate seating, meal catalog, court controls, audit log |
| **Room Display** | `D-1-DC-26-301874-DISPLAY` | **`673490`** | `/display`: Read-only full-screen projector view for wall display (synced timeline, active exhibit, final vote results) |

### 2. Court Admin Office Portal (Port 4100)

Access URL: **`http://localhost:4100`** (or `http://<LAN-IP>:4100` on the court office network)

| Role | Username | Password | Capabilities |
|---|---|---|---|
| **Court Administrator** | `admin` | **`kestrel-timber-95-upland`** | Full court administration: user account management, case creation, charge editor, exhibit admission, package export |
| **Deputy Clerk** | `clerk` | **`timber-pebble-27-ember`** | Trial preparation: case drafting, exhibit checksum verification, recording judicial sign-offs, sending cases directly to jury iPads |

---

## The Pre-Seeded Texas Trial Case

The jury server on port 4000 is already seeded with a complete, realistic Texas criminal prosecution under Texas statutory law:

- **Caption:** *The State of Texas v. Cody Ray Brennan*
- **Cause Number:** `D-1-DC-26-301874`
- **Court:** 427th District Court, Travis County, Texas
- **Burden of Proof & Presumption of Innocence:** Quoted from Texas Code of Criminal Procedure art. 38.03 and Texas Pattern Jury Charges.

### Counts & Statutory Definitions

1. **Count 1: Intoxication Assault** (Texas Penal Code § 49.07(a)(1) — 3rd Degree Felony)
   - *Elements:* Operating a motor vehicle (gray 2019 Ford F-150) in a public place (Cedar Hollow Road near Bluff Creek Drive) while intoxicated; by reason of that intoxication, causing serious bodily injury to Lucía Ferrer by accident or mistake by striking her bicycle.
   - *Definitions:* Intoxication (loss of normal faculties or 0.08+ BAC), serious bodily injury, public place, causation under Penal Code § 6.04(a).
2. **Count 2: Accident Involving Injury (Failure to Stop and Render Aid)** (Texas Transportation Code §§ 550.021, 550.023 — 3rd Degree Felony)
   - *Elements:* Operating vehicle involved in an accident resulting in injury to Lucía Ferrer; knowing accident occurred; intentionally or knowingly failing to immediately stop and remain to render reasonable assistance.
   - *Definitions:* Reasonable assistance, knowing conduct under Penal Code § 6.03(b).
3. **Count 3: Lesser-Included Offense: Driving While Intoxicated** (Texas Penal Code § 49.04(a) — Class B Misdemeanor)
   - *Elements:* Operating a motor vehicle in a public place while intoxicated.

### 10 Admitted Exhibits in the Locker

- **State's Exhibit S-1 (PDF):** Texas Peace Officer's Crash Report (Form CR-3 excerpt) by Deputy H. Kowalski #4471.
- **State's Exhibit S-2 (Color Graphic):** Official Scene Diagram (Cedar Hollow Rd at Bluff Creek Dr — point of impact, tire mark onto shoulder, final rest of bicycle, witness vehicle position).
- **State's Exhibit S-3 (Photograph):** High-resolution forensic photograph of the defendant's 2019 Ford F-150 showing right front fender dent and broken mirror mount.
- **State's Exhibit S-4 (PDF):** Texas DPS Austin Crime Laboratory Toxicology Report (0.118 g/100 mL blood alcohol concentration drawn under warrant at 2:41 AM).
- **State's Exhibit S-5 (PDF):** Certified Bar Tab Receipt from The Rusty Spur (5 pints Shiner Bock, 2 shots Jameson, brisket tacos; tab closed 11:26 PM).
- **State's Exhibit S-6 (PDF):** Certified Medical Records Summary from St. Brigid Medical Center Trauma Service (Lucía Ferrer: open tibia/fibula fracture with intramedullary rod, pelvic fracture).
- **Defense Exhibit D-1 (Photograph):** TCSO body-worn camera still taken at 12:38 AM in Brennan's kitchen showing open whiskey bottle and glass.
- **Defense Exhibit D-2 (PDF):** Forensic Toxicology Consultation Report by Alan Whitcomb, Ph.D., on retrograde extrapolation, alcohol absorption, and drinking after driving.
- **Court Transcript Tr-1 (Interactive Transcript):** Sworn trial testimony of Deputy Hannah Kowalski (Travis County Sheriff's Office).
- **Court Transcript Tr-2 (Interactive Transcript):** Sworn trial testimony of eyewitness Darnell Price.

### 19 Pre-Loaded Deliberation Timeline Events

A chronological timeline built by the jury is pre-seeded with 19 interactive events spanning 8:52 PM on June 6, 2026 through September follow-up, complete with attached exhibits and line-by-line transcript excerpt cross-references. Jurors can also propose new events, add private notes, or edit timeline cards.

---

## All scripts

| Script | What it does |
|---|---|
| `npm run demo` | **Recommended for judging:** builds bundles if needed, seeds both Jury App (:4000) with the Texas trial and Court Admin (:4100), prints credentials & opens browser |
| `npm run demo:reset` | Resets and re-seeds both databases with clean deterministic demo data, then launches |
| `npm run demo:dev` | Runs both apps in development mode with Vite hot-reloading |
| `npm run dev` | Express API on :4000 plus Vite on :5173 (jury app only) |
| `npm run build` | Production build of the jury client (`client/dist`) |
| `npm start` | Production jury server on :4000 serving `client/dist` and API |
| `npm run seed` | Rebuilds jury demo case data (Texas trial) and prints PINs |
| `npm run admin:dev` | Court Admin API on :4100 plus Vite on :5174 |
| `npm run admin:build` / `admin:start` | Build and serve Court Admin portal on :4100 |
| `npm run admin:seed` | Rebuilds Court Admin demo accounts and cases |
| `npm run pdf:case` | Generates official 1-page bench sheet & verdict form PDF for the active trial |

Set `PORT` to change the port (`PORT=8080 npm start`). Set
`ALLOW_ONLINE_EXHIBITS=1` to allow YouTube exhibits (see above); without it
they can't be added, and any already loaded are hidden from jurors and the display.

---

## Evaluator Walkthrough

1. **Jury App Review (Port 4000):**
   - Navigate to `http://localhost:4000`.
   - Sign in as Foreperson with Sign-in ID **`D-1-DC-26-301874-1`** and PIN **`863462`**. (Note: Entering bare numbers like `1` is rejected to support concurrent trials).
   - Tap **"Guided tour"** in the sidebar for an interactive 2-minute walkthrough of:
     - Exhibit Locker (PDF viewer, image zoom, side-by-side split review with transcripts).
     - Timeline (19 chronological events with attached exhibits).
     - Private Notes (personal notes & transcript highlights that follow the juror across devices).
     - Secret Ballots & Polls (anonymous voting engine with mathematical privacy guarantees).
     - Requests & Question to Judge (messaging channel with the bailiff).
     - Room Projector control.
2. **Staff Station Review:**
   - Sign out and sign in as `D-1-DC-26-301874-B1` (or `B1`) with PIN **`906447`** (Bailiff).
   - View the live juror presence dashboard, answer judge questions in the request queue, review the immutable SHA-256 audit log, and inspect juror seat controls.
3. **Wall Projector Review:**
   - In another browser tab, sign in as `D-1-DC-26-301874-DISPLAY` (or `DISPLAY`) with PIN **`673490`**.
   - Witness the read-only, full-screen live view that forepersons control from their iPads.
4. **Court Admin Office Portal (Port 4100):**
   - Navigate to `http://localhost:4100`.
   - Sign in as `admin` with password **`kestrel-timber-95-upland`**.
   - Review trial case preparation, charge elements, admitted evidence, judicial sign-off checklists, and the one-click **"Send to jury iPads"** transfer mechanism.

---

## Who signs in where

| Role | Sign in with | Lands on |
|---|---|---|
| Juror | `<caseNumber>-<seat>` (e.g. `D-1-DC-26-301874-2` to `12`) + PIN | `/juror`: evidence, side-by-side review, shared and personal timelines, voting, private notes, requests, read aloud |
| Foreperson | `<caseNumber>-1` (e.g. `D-1-DC-26-301874-1`) + PIN | same as juror, plus poll/ballot controls, judge questions, the "we have a verdict" notice, room-display control |
| Room display | `D-1-DC-26-301874-DISPLAY` (or `DISPLAY`) + PIN | `/display`: full-screen projector view (read-only) |
| Bailiff / Clerk | `D-1-DC-26-301874-B1` (or `B1`) + PIN | `/admin`: request queue and the court's answers, evidence upload, seats & PINs, menu, court controls, audit log |

The clerk can reset PINs, reassign the foreperson, excuse seats and seat
alternates from **Admin → Juror seats**. PINs are stored only as salted scrypt
hashes.

Roles are enforced **on the server** for every REST route and every socket
event (`requireRole` in `server/auth.js`; the per-event role table in
`server/sockets/deliberation.js`). Hiding UI is never the only protection.

---

## Loading a real case

The recommended way is **Court Admin** (below): prepare the case in the court
office and send it to the jury iPads. To set a case up by hand
on the jury laptop instead:

1. `npm run seed` to create seats, staff accounts and PINs. Edit
   `server/scripts/lib/texas-case.js` or `case-content.js` first to set the caption, case number
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
beside every ballot) live in the case definition files too. For a real trial, copy them
from the judge's written instructions.

---

## Court Admin (court office app)

A separate website in `court-admin/` where clerks prepare trials: cases and
their charges, admitted exhibits, juror seats and PINs, and the menu. It runs
on the same machine as the jury server and sends a ready case straight to
the jurors' iPads.

```bash
npm run admin:seed          # demo: admin + clerk accounts, ready cases, and draft
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
   `npm run import-case -- /Volumes/USB/D-1-DC-26-301874.jurycase.tar` there with
   its jury server stopped (`--replace` once the court is finished with the
   previous trial).

Court Admin has its own accounts (admins manage accounts; clerks do
everything else), its own hash-chained audit log (**Audit log**), and the
same offline rules as the jury app: a strict CSP and no outside requests.
The package is a plain tar (`manifest.json`, `manifest.sha256`, `exhibits/…`)
that any tar tool can list. The manifest lists every exhibit's SHA-256.

---

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

---

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

---

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

---

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

---

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
  scripts/seed.js       demo Texas case (State v. Cody Ray Brennan), generated PDFs/PNGs/transcripts
  lib/case-import.js    checks and loads a Court Admin case package
  routes/local.js       lets Court Admin on this machine send a case (localhost only)
  scripts/import-case.js  loads a downloaded case package from the command line
  lib/tar.js            tar writer/reader for case packages (shared with Court Admin)
  data/                 db.json (lowdb), uploads, audit log, demo PINs (git-ignored)
court-admin/
  client/               the office website: cases, charges, evidence, jury & PINs, sign-off & send, accounts, audit
  server/               Express API on :4100, own accounts, db, uploads and audit log; reuses server/lib
```
