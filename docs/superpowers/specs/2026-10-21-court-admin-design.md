# Court Admin: design and build plan

Status: built (2026-10-21). See the README section "Court Admin" for usage.

A separate web app for the court office. Clerks prepare a trial for
deliberation: the case and its charges, the admitted exhibits, juror seats
and PINs, and the menu. When the case is ready, the app exports **one case
package file**. The clerk carries it to the jury laptop on a USB drive and
imports it there. The jury network never connects to the office network.

## Decisions (from the user)

| Question | Answer |
|---|---|
| Getting a case to the jury laptop | Export a case package file; import it on the jury laptop |
| What admins manage | Cases and charges, evidence, jurors and PINs, menu and supplies |
| Sign-in | Individual accounts with `admin` and `clerk` roles |
| Exhibit sign-off | Required before export; any exhibit change clears it |

## Where it lives

```
court-admin/
  server/   Express + lowdb, its own data folder, port 4100
  client/   React + Vite + Tailwind (same stack and look as the jury app), dev port 5174
server/scripts/import-case.js   new: jury-laptop importer
```

Both new folders are npm workspaces. The admin server reuses the jury
server's `lib/exhibits.js` (file sniffing, transcript parsing, video frame
rate) and `lib/util.js` (validation), which depend only on Node built-ins.
It has its own config, database, auth and audit log, and shares no runtime
state with the jury server.

Root scripts: `admin:dev`, `admin:build`, `admin:start`, `admin:seed`,
`admin:create-user`, and `import-case` for the jury laptop.

## Data (court-admin/server/data/db.json)

- `users`: `{ id, username, name, role: 'admin'|'clerk', passHash, passSalt, active }`
- `sessions`: hashed tokens, httpOnly cookie, 12-hour lifetime
- `cases`: `{ id, caption, caseNumber, court, burden, counts[], status, seats, signoff, exports[], createdAt, updatedAt }`
  - `counts[]`: `{ id, label, statute, summary, elements[], definitions[{term,text}] }`, the same shape the jury app already uses
  - `status`: `'active' | 'archived'`
  - `seats`: `{ count: 6–12, foreperson, jurors: [{ seat, pinHash, pinSalt }], bailiff: {login, name, pinHash, pinSalt}, display: {...} }`
- `exhibits`: `{ id, caseId, number, title, party, dateAdmitted, description, status: 'admitted'|'withdrawn', type, file{stored, mime, size, originalName, sha256}, lines?, fps?, uploadedBy, uploadedAt }`
- `menu`, `supplies`: one shared library, included in every export

PINs are shown once when generated (with a printable PIN sheet) and stored
only as scrypt hashes in the format the jury server already verifies, so the
package carries hashes and never plaintext.

## Sign-off

The clerk records that the judge, the prosecution and the defense approved
the exhibit list (three names and a date). The sign-off stores a fingerprint
of the admitted exhibits (ids, numbers, titles and file SHA-256s). It is
valid only while the fingerprint still matches, so adding, editing,
withdrawing or replacing an exhibit clears it automatically.

## Export

`GET /api/cases/:id/export` streams a plain **tar** file
(`<case-number>.jurycase.tar`, readable by any tar tool), with no extra
dependency:

```
manifest.json          format version, case, counts, burden, seats (hashes), menu, supplies,
                       admitted exhibits with metadata and sha256, sign-off, exportedBy/At
exhibits/<stored file> one per admitted exhibit
```

Export is refused unless the case has a caption, a case number, at least one
count, at least one admitted exhibit, PINs for every seat plus the bailiff
and display, a foreperson, and a valid sign-off. Each export is logged with
its time and user.

## Signing (added after the first build)

Checksums catch a damaged package, not a deliberately altered one. So the
office server and each jury laptop share a 256-bit secret key, set up once
(`npm run admin:package-key -- --out <file>` on the office server,
`npm run trust-package-key -- <file>` on the laptop; both print the same
short fingerprint). Export adds `manifest.sig`, an HMAC-SHA256 of
`manifest.json`; because the manifest lists every exhibit's SHA-256, the
signature covers the whole package. Export is blocked until the office
server has a key; import is refused without a trusted key or with a
signature that doesn't match. Changing a laptop's key needs `--replace`.
Keys are stored with mode 0600 in each app's git-ignored `data/` folder.

## Import (jury laptop)

`npm run import-case -- <file> [--replace]` with the jury server stopped:

1. Reads the tar, checks the manifest's checksum and then its signature
   against the trusted key, checks the format version, and verifies every exhibit's
   SHA-256 against the manifest. Any mismatch aborts with nothing changed.
2. Refuses if the jury database already holds deliberation work (timeline,
   votes, requests, notes) unless `--replace` is given.
3. Re-checks each exhibit with the jury server's own `sniffFile` instead of
   trusting the manifest, re-parses transcripts and reads video frame rates.
4. Archives the old audit log (as `seed` does), writes a fresh `db.json`
   with the case, seats, bailiff and display logins, exhibits, menu and
   supplies, and copies the files into `uploads/exhibits`.
5. Prints a summary. PINs are the ones on the printed PIN sheet.

## Screens

- **Sign in.** A first admin account comes from `npm run admin:create-user`
  or `npm run admin:seed` (demo data and a random password saved to a
  git-ignored credentials file).
- **Cases.** A list with search and an archived filter; create a case.
- **Case** tabs:
  - *Details*: caption, case number, court, burden of proof
  - *Charges*: add, reorder and edit counts, elements and definitions
  - *Evidence*: upload (PDF, images, `.txt` transcripts, video up to 2 GB), edit, withdraw or restore, preview
  - *Jury*: seat count, foreperson, generate PINs, printable PIN sheet, bailiff and display logins
  - *Sign-off & export*: readiness checklist, sign-off form, export button, export history
- **Menu & supplies**: the shared library
- **Users** (admin only): add, deactivate, reset password, change role
- **Audit log**: hash-chained like the jury app's, recording who did what and when

## Security

Same rules as the jury app: role checks on the server for every route,
strict CSP, no external requests, uploads checked by file content (SVG and
HTML refused), scrypt password hashes, login throttling, and an audit log
whose `meta` passes through an allowlist.

## Build order

1. Workspaces, admin server skeleton (config, db, auth, audit, security headers)
2. Users, sessions, `create-user` and `seed` scripts
3. Cases and charges API
4. Exhibits API (upload, edit, withdraw, file serving, sha256)
5. Jury seats and PINs API; sign-off; tar export
6. Jury-side `import-case` script with tar reader and verification
7. Admin client: shell, login, cases, case tabs, menu, users, audit
8. Tests: an end-to-end script that seeds, builds a case through the API,
   exports it, imports it into a scratch jury server, and signs in as a juror
9. README sections for both apps

## Out of scope

Pushing a case over the network, editing a case after import on the jury
laptop (the jury app's bailiff screens still handle that), multiple courts
or tenants, and live deliberation monitoring.
