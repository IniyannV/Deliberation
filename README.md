# Deliberation

An offline web application for sequestered or deliberating juries. A single laptop runs the court's local server; juror devices, the room projector, and the bailiff's station connect over a closed LAN using standard web browsers.

**Zero external dependencies.** The app never touches the public internet—no CDNs, web fonts, remote APIs, analytics, or telemetry. Express serves a strict Content Security Policy so client browsers refuse any request not originating from the local machine. (The only optional exception is YouTube video exhibits, which remain disabled unless explicitly started with `ALLOW_ONLINE_EXHIBITS=1`.)

> **Note:** Seed data, exhibits, and case names used in the demo are fictional.

---

## Live Demos

- [Jury Deliberation Portal](https://deliberation-jury.soumilvoona.me)
- [Court Admin Portal](https://deliberation-admin.soumilvoona.me)
- [Demo Credentials](#demo-credentials)

---

## Quick Start

Requires Node 20+.

```bash
npm install
npm run demo
```

`npm run demo` starts both local services and opens the app in your browser:
- **Jury Deliberation (`http://localhost:4000`):** Seeded with a sample Texas trial (*The State of Texas v. Cody Ray Brennan*), including 10 admitted exhibits, interactive transcripts, and timeline events.
- **Court Admin (`http://localhost:4100`):** The clerk's workstation for drafting charges, verifying exhibit checksums, and generating juror PIN slips.

---

## Demo Credentials

All test accounts use deterministic logins generated during seeding.

### Jury Room Service (`http://localhost:4000`)

| Role | Sign-in ID | PIN | Access & Notes |
|---|---|---|---|
| **Foreperson (Seat 1)** | `D-1-DC-26-301874-1` | `863462` | Full juror tools + call votes/polls, submit questions to judge, announce verdict, control room display |
| **Juror (Seat 2)** | `D-1-DC-26-301874-2` | `377793` | Evidence locker, split review, collaborative timeline, private notes/highlights, secret ballot voting |
| **Jurors (Seats 3–12)** | `D-1-DC-26-301874-<seat>` | *(see below)* | Same tools as Seat 2. Full seat list printed on startup and saved to `server/data/demo-credentials.txt` |
| **Bailiff / Clerk** | `D-1-DC-26-301874-B1` | `906447` | Request queue, official court answers, juror seat PIN resets, meal catalog, court controls, audit log |
| **Wall Projector** | `D-1-DC-26-301874-DISPLAY` | `673490` | Read-only full-screen display synced in real time to the foreperson's controls |

<details>
<summary>PINs for Juror Seats 3 through 12</summary>

- **Seat 3:** `606667`
- **Seat 4:** `060801`
- **Seat 5:** `356725`
- **Seat 6:** `438289`
- **Seat 7:** `177224`
- **Seat 8:** `105733`
- **Seat 9:** `109656`
- **Seat 10:** `403991`
- **Seat 11:** `494894`
- **Seat 12:** `181719`

</details>

### Court Admin Office Portal (`http://localhost:4100`)

| Role | Username | Password | Notes |
|---|---|---|---|
| **Court Administrator** | `admin` | `kestrel-timber-95-upland` | User account management, case drafting, charges editor, package export |
| **Deputy Clerk** | `clerk` | `timber-pebble-27-ember` | Exhibit checksum verification, judicial sign-off checklists, direct transfer to jury iPads |

---

## Quick Walkthrough

1. **Jury App (`http://localhost:4000`):**
   - Sign in as Foreperson (`D-1-DC-26-301874-1` / `863462`).
   - Click **"Guided tour"** in the sidebar for an overview of the evidence locker, split-screen review, collaborative timeline, private juror notes, and anonymous voting.
2. **Staff Station:**
   - In a private window or another browser, sign in as Bailiff (`D-1-DC-26-301874-B1` / `906447`).
   - Monitor connected devices, respond to juror questions in the request queue, inspect juror seat assignments, and review the append-only audit log.
3. **Room Projector (`/display`):**
   - Open a tab with `D-1-DC-26-301874-DISPLAY` / `673490`.
   - As the foreperson selects exhibits or shares timeline cards, the room display updates automatically.
4. **Court Admin Portal (`http://localhost:4100`):**
   - Sign in as `admin` (`kestrel-timber-95-upland`).
   - Inspect case preparation, legal elements, admitted evidence lists, and the **"Send to jury iPads"** transfer pipeline.

---

## Seed Case: *The State of Texas v. Cody Ray Brennan*

The local database comes pre-loaded with a realistic sample prosecution from the 427th District Court, Travis County, Texas (Cause `D-1-DC-26-301874`):

- **Counts & Definitions:** Intoxication Assault (Tex. Penal Code § 49.07), Accident Involving Injury / Failure to Stop and Render Aid (Tex. Transp. Code §§ 550.021, 550.023), and Lesser-Included DWI (Tex. Penal Code § 49.04). Each count displays statutory elements, definitions, and burden-of-proof instructions alongside the voting ballot.
- **10 Admitted Exhibits:** Police crash report (CR-3), incident scene diagram, forensic damage photos of the suspect vehicle, DPS toxicology report (0.118 BAC), bar tab receipt, hospital trauma summary, kitchen bodycam stills, defense toxicologist consultation report, and interactive sworn trial transcripts for the responding deputy and eyewitness.
- **19 Deliberation Timeline Events:** Chronological events spanning the incident, investigation, and testing, cross-referenced with exhibits and transcript page/line citations.

---

## Architecture & How It Works

The system is split into two lightweight Node/Express microservices designed to run on a court laptop without external database servers:

```
client/                 React (Vite, Tailwind, Zustand) — Juror UI & Room Display
server/                 Express + Socket.IO (:4000) — Deliberation API, realtime sync & evidence
court-admin/
  client/               React (Vite) — Court Clerk & Admin Portal
  server/               Express (:4100) — Case drafting, sign-off workflow & package export
```

### Communication Between Services
Court Admin runs on port 4100 on the court network. When a case is ready and counsel sign-offs are logged, clicking **"Send to jury iPads"** sends the packaged case straight to the jury server on port 4000 over `localhost` (`/api/local`). The jury server validates the tar package manifest and exhibit SHA-256 hashes, archives the previous trial's audit log, and reloads the active trial immediately.

---

## Privacy & Security Model

Jury deliberations require strict legal privacy safeguards:

- **Anonymous Ballots & Polls:** The server tracks *that* a juror voted separately from *which* choice they made, storing vote tallies in memory only. Neither individual votes nor active tallies are ever written to disk. Closed votes record only the final outcome (unanimous guilty/not guilty or non-unanimous).
- **Tamper-Evident Audit Log:** `server/data/audit.log.jsonl` is append-only and SHA-256 hash-chained. It records logins, device connects, exhibit additions/removals, and administrative actions with timestamps and actors. It **never** records deliberation content, private notes, transcript highlights, timeline text, or vote counts.
- **Private Notes & Transcripts:** Juror highlights and notes are tied to the juror's seat session and follow them across devices, but are completely hidden from other jurors and court staff.
- **Isolated Bailiff Threads:** Juror requests (e.g., meal preferences, room supplies) are private threads between that specific juror and the bailiff. Only formal questions for the judge and verdict notices are broadcast to the entire jury.
- **Court Controls & End of Trial:** Staff can mass sign-out all devices at the end of each day. Once a verdict is reached and deliberations conclude, **Court controls → Erase permanently** purges all shared and personal timelines, notes, votes, and chat messages while retaining the administrative audit record.

---

## Offline Guarantees

- **No Remote Assets:** System fonts only (SF Pro on Apple devices, Segoe UI/Roboto elsewhere). No Google Fonts, external CDN bundles, or tracking scripts.
- **Embedded PDF Engine:** pdf.js worker, standard fonts, and decoders are bundled locally in `client/public/pdfjs`.
- **Strict Content Security Policy:**
  ```text
  default-src 'self'; connect-src 'self' ws:; img-src 'self' blob: data:; font-src 'self'; frame-src 'self'
  ```
  All scripts and network requests outside the local server are blocked by the browser.

---

## iPad & Touch-Screen Optimization

The juror interface is tuned specifically for 10th-generation iPads (820 × 1180 pt):
- **Responsive Layout:** Side-by-side split review in landscape; auto-collapsing sidebar drawer in portrait.
- **Touch-Friendly Controls:** Minimum 44pt tap targets, double-tap zoom disabled to eliminate tap delay, and long-press alternatives for secondary actions (pinning notes on photos, context menus).
- **Video Review:** Dedicated playback controls with single-frame stepping (⏴| / |⏵ or arrow keys) and scrub controls.
- **Home Screen Web App:** Compatible with Safari's "Add to Home Screen" mode for full-screen kiosk operation without browser navigation chrome.

---

## Management & Scripts

| Command | Description |
|---|---|
| `npm run demo` | Build assets (if needed), seed sample trial and staff accounts, and launch both apps |
| `npm run demo:reset` | Reset databases, re-seed clean demo data, and launch |
| `npm run demo:dev` | Start both jury and admin services with Vite hot-reloading |
| `npm run dev` | Run jury server (`:4000`) and client Vite dev server (`:5173`) |
| `npm run build` | Build jury client bundle (`client/dist`) |
| `npm start` | Production jury server on `:4000` serving static bundle + API |
| `npm run seed` | Re-seed the sample Texas trial into the jury server |
| `npm run admin:dev` | Run Court Admin server (`:4100`) and client Vite dev server (`:5174`) |
| `npm run admin:build` / `admin:start` | Build and run production Court Admin portal |
| `npm run admin:seed` | Re-seed Court Admin user accounts and draft cases |
| `npm run admin:create-user` | CLI command to create an admin account (`--username <user> --name "<name>"`) |
| `npm run pdf:case` | Generate a 1-page bench sheet and verdict form PDF for the active case |
| `npm run import-case -- <file>` | Manually import a `.jurycase.tar` package on an isolated laptop |

---

## Project Structure

```
client/                 React frontend for jurors, bailiffs, and room display
  src/features/         Evidence viewers (PDF, photo, video, transcript), timeline, voting, notes
  src/pages/            Login, juror dashboard, display view, admin dashboard
  src/store/            Auth state, realtime socket sync, UI store

server/                 Jury room backend (Node.js & Express)
  index.js              HTTP server, Socket.IO setup, and static client serving
  auth.js               PIN hashing (scrypt), session cookie validation, role guards
  routes/               Endpoints for auth, exhibits, juror tools, admin, and local import
  sockets/              Realtime event handlers (timeline, notes, voting, display sync)
  services/             voting.js (anonymous voting engine), audit.js (hash-chained log)
  data/                 Embedded JSON database (lowdb), file uploads, audit logs

court-admin/            Court office application
  client/               React frontend for case preparation, evidence review, and PIN slips
  server/               Express server (:4100) managing draft cases, judicial approvals, and export
```
