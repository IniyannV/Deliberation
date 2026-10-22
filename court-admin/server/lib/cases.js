import crypto from 'node:crypto';
import { db } from '../db.js';
import { HttpError, bad, compareExhibitNumbers, int, isoDate, newId, nowIso, optStr, str } from './shared.js';

/*
 * A case, as the court office prepares it for the jury room:
 *
 *   { id, caption, caseNumber, court, burden, counts, status: 'active' | 'archived',
 *     jury: { seatCount, foreperson, seats: { [seat]: pin }, names: { [seat]: string }, bailiff: { login, name, ...pin }, display: pin },
 *     signoff: { judge, prosecution, defense, date, recordedBy, recordedAt, fingerprint } | null,
 *     exports: [{ at, by, bytes, exhibitCount, method: 'sent' | 'download' }], createdAt, createdBy, updatedAt }
 *
 * A `pin` is { pinHash, pinSalt, setAt }: the same salted scrypt hash the jury
 * server verifies, so a case package carries hashes and never a plain PIN.
 * `counts` use the jury app's shape: { id, label, statute, summary, elements[], definitions[{ term, text }] }.
 */

export const DEFAULT_BURDEN = 'The prosecution must prove every element of a count beyond a reasonable doubt. If it has not proven any one element, you must find the defendant not guilty of that count.';

export const findCase = (id) => {
  const c = db.data.cases.find((x) => x.id === id);
  if (!c) throw new HttpError(404, 'Case not found');
  return c;
};

export const caseExhibits = (caseId) => db.data.exhibits.filter((e) => e.caseId === caseId).sort(compareExhibitNumbers);
export const admittedExhibits = (caseId) => caseExhibits(caseId).filter((e) => e.status === 'admitted');

export function readDetails(body, { partial = false } = {}) {
  const out = {};
  const has = (k) => !partial || body[k] !== undefined;
  if (has('caption')) out.caption = str(body.caption, { min: 1, max: 160, field: 'Caption' });
  if (has('caseNumber')) out.caseNumber = str(body.caseNumber, { min: 1, max: 40, field: 'Case number' });
  if (has('court')) out.court = optStr(body.court, { max: 160, field: 'Court' });
  if (has('burden')) out.burden = optStr(body.burden, { max: 4000, field: 'Burden of proof' }) || DEFAULT_BURDEN;
  if (body.status !== undefined) out.status = body.status === 'archived' ? 'archived' : 'active';
  return out;
}

export function assertUniqueCaseNumber(caseNumber, exceptId) {
  const n = caseNumber.toLowerCase();
  if (db.data.cases.some((c) => c.id !== exceptId && c.caseNumber.toLowerCase() === n)) throw bad(`Case ${caseNumber} already exists`);
}

/** The whole list of counts, as the charges editor sends it. Existing ids are kept so ballots stay stable. */
export function readCounts(raw) {
  if (!Array.isArray(raw) || raw.length > 40) throw bad('Too many counts');
  return raw.map((c, i) => {
    const n = i + 1;
    const elements = Array.isArray(c?.elements) ? c.elements : [];
    const definitions = Array.isArray(c?.definitions) ? c.definitions : [];
    if (elements.length > 30 || definitions.length > 30) throw bad(`Count ${n} has too many entries`);
    return {
      id: typeof c?.id === 'string' && /^[\w-]{1,40}$/.test(c.id) ? c.id : newId('count'),
      label: str(c?.label, { min: 1, max: 200, field: `Count ${n} label` }),
      statute: optStr(c?.statute, { max: 200, field: `Count ${n} statute` }),
      summary: optStr(c?.summary, { max: 2000, field: `Count ${n} summary` }),
      elements: elements.map((e, j) => str(e, { min: 1, max: 1000, field: `Count ${n}, element ${j + 1}` })),
      definitions: definitions.map((d, j) => ({
        term: str(d?.term, { min: 1, max: 120, field: `Count ${n}, definition ${j + 1} term` }),
        text: str(d?.text, { min: 1, max: 2000, field: `Count ${n}, definition ${j + 1}` }),
      })),
    };
  });
}

export function newJury() {
  return { seatCount: 12, foreperson: 1, seats: {}, names: {}, bailiff: { login: 'B1', name: 'Bailiff' }, display: {} };
}

export function readJury(body, jury) {
  const next = { ...jury };
  if (body.seatCount !== undefined) next.seatCount = int(body.seatCount, { min: 6, max: 12, field: 'Number of seats' });
  if (body.foreperson !== undefined) next.foreperson = int(body.foreperson, { min: 1, max: next.seatCount, field: 'Foreperson seat' });
  if (next.foreperson > next.seatCount) next.foreperson = 1;
  // Seats past the new count lose their PINs.
  next.seats = Object.fromEntries(Object.entries(jury.seats).filter(([seat]) => Number(seat) <= next.seatCount));
  // Jurors' names, by seat. A blank name clears it.
  const names = { ...jury.names, ...(body.names && typeof body.names === 'object' ? body.names : {}) };
  next.names = {};
  for (const [seat, name] of Object.entries(names)) {
    const n = Number(seat);
    if (!Number.isInteger(n) || n < 1 || n > next.seatCount) continue;
    const clean = optStr(name, { max: 80, field: `Seat ${n} name` });
    if (clean) next.names[n] = clean;
  }
  if (body.bailiffLogin !== undefined || body.bailiffName !== undefined) {
    const login = body.bailiffLogin !== undefined ? str(body.bailiffLogin, { min: 1, max: 16, field: 'Bailiff sign-in ID' }) : jury.bailiff.login;
    // Jurors sign in with a seat number, so a staff ID must not look like one.
    if (/^\d{1,2}$/.test(login)) throw bad('The bailiff’s sign-in ID must include a letter, such as B1');
    if (login.toLowerCase() === 'display') throw bad('DISPLAY is reserved for the room display');
    const name = body.bailiffName !== undefined ? str(body.bailiffName, { min: 1, max: 80, field: 'Bailiff name' }) : jury.bailiff.name;
    next.bailiff = { ...jury.bailiff, login, name };
  }
  return next;
}

/* ── PINs ──────────────────────────────────────────────────────────── */

const randomPin = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

// Must match verifyPin() in the jury server's auth.js.
function hashPin(pin) {
  const pinSalt = crypto.randomBytes(16).toString('hex');
  const pinHash = crypto.scryptSync(pin, pinSalt, 32).toString('hex');
  return { pinSalt, pinHash, setAt: nowIso() };
}

/**
 * New PINs for `which`: 'all', 'missing', 'bailiff', 'display', a seat
 * number, or a list of those (to print a chosen set of slips at once).
 * Returns the plain PINs, which are shown once and never stored.
 */
export function generatePins(c, which) {
  if (Array.isArray(which)) {
    if (!which.length || which.length > 20) throw bad('Choose who needs new PINs');
    const seen = new Set();
    return which.map(String).filter((w) => !seen.has(w) && seen.add(w)).flatMap((w) => generatePins(c, w));
  }
  const issued = [];
  const issue = (who, signIn, set) => {
    const pin = randomPin();
    set(hashPin(pin));
    issued.push({ who, signIn, pin });
  };
  const seat = (n) => {
    const name = c.jury.names?.[n];
    issue(`${name ? `${name}, juror` : 'Juror'} seat ${n}${n === c.jury.foreperson ? ' (foreperson)' : ''}`, String(n), (h) => { c.jury.seats[n] = h; });
  };
  const bailiff = () => issue(`Bailiff (${c.jury.bailiff.name})`, c.jury.bailiff.login, (h) => { c.jury.bailiff = { ...c.jury.bailiff, ...h }; });
  const display = () => issue('Room display', 'DISPLAY', (h) => { c.jury.display = h; });

  if (which === 'all' || which === 'missing') {
    for (let n = 1; n <= c.jury.seatCount; n++) if (which === 'all' || !c.jury.seats[n]) seat(n);
    if (which === 'all' || !c.jury.bailiff.pinHash) bailiff();
    if (which === 'all' || !c.jury.display.pinHash) display();
  } else if (which === 'bailiff') bailiff();
  else if (which === 'display') display();
  else seat(int(which, { min: 1, max: c.jury.seatCount, field: 'Seat' }));
  return issued;
}

/* ── Sign-off ──────────────────────────────────────────────────────── */

/**
 * A fingerprint of the admitted exhibit list. The sign-off stores it, so
 * adding, editing, withdrawing or replacing an exhibit voids the sign-off.
 */
export function exhibitFingerprint(caseId) {
  const list = admittedExhibits(caseId).map((e) => [e.id, e.number, e.title, e.party, e.dateAdmitted, e.description ?? '', e.file.sha256]);
  return crypto.createHash('sha256').update(JSON.stringify(list)).digest('hex');
}

export const signoffValid = (c) => !!c.signoff && c.signoff.fingerprint === exhibitFingerprint(c.id);

export function readSignoff(body) {
  return {
    judge: str(body.judge, { min: 1, max: 120, field: 'Judge' }),
    prosecution: str(body.prosecution, { min: 1, max: 120, field: 'Prosecution counsel' }),
    defense: str(body.defense, { min: 1, max: 120, field: 'Defense counsel' }),
    date: isoDate(body.date, 'Date of approval'),
  };
}

/* ── Readiness ─────────────────────────────────────────────────────── */

/** What still stands between this case and an export, as a checklist. */
export function readiness(c) {
  const admitted = admittedExhibits(c.id);
  const missing = [];
  for (let n = 1; n <= c.jury.seatCount; n++) if (!c.jury.seats[n]) missing.push(`seat ${n}`);
  if (!c.jury.bailiff.pinHash) missing.push('bailiff');
  if (!c.jury.display.pinHash) missing.push('room display');
  const countsOk = c.counts.length > 0 && c.counts.every((k) => k.elements.length > 0);
  const checks = [
    { key: 'details', label: 'Caption, case number and court', ok: !!(c.caption && c.caseNumber && c.court) },
    { key: 'counts', label: 'At least one count, each with its elements', ok: countsOk, detail: countsOk ? `${c.counts.length} count${c.counts.length === 1 ? '' : 's'}` : c.counts.length ? 'A count has no elements' : 'No counts yet' },
    { key: 'exhibits', label: 'At least one admitted exhibit', ok: admitted.length > 0, detail: `${admitted.length} admitted` },
    { key: 'pins', label: 'PINs for every seat, the bailiff and the room display', ok: !missing.length, detail: missing.length ? `Missing: ${missing.join(', ')}` : 'All set' },
    { key: 'signoff', label: 'Exhibit list approved by the judge and both counsel', ok: signoffValid(c), detail: c.signoff && !signoffValid(c) ? 'The exhibits changed after the sign-off. Record it again.' : undefined },
    { key: 'active', label: 'Case is not archived', ok: c.status !== 'archived' },
  ];
  return { ready: checks.every((x) => x.ok), checks };
}

/* ── Views ─────────────────────────────────────────────────────────── */

const pinState = (p) => (p?.pinHash ? { set: true, setAt: p.setAt } : { set: false });

export function publicJury(jury) {
  const seats = [];
  for (let n = 1; n <= jury.seatCount; n++) seats.push({ seat: n, name: jury.names?.[n] ?? '', ...pinState(jury.seats[n]) });
  return {
    seatCount: jury.seatCount,
    foreperson: jury.foreperson,
    seats,
    bailiff: { login: jury.bailiff.login, name: jury.bailiff.name, ...pinState(jury.bailiff) },
    display: pinState(jury.display),
  };
}

export function publicExhibit(e) {
  return {
    id: e.id,
    caseId: e.caseId,
    number: e.number,
    title: e.title,
    party: e.party,
    dateAdmitted: e.dateAdmitted,
    description: e.description ?? '',
    status: e.status,
    type: e.type,
    size: e.file.size,
    mime: e.file.mime,
    originalName: e.file.originalName,
    sha256: e.file.sha256,
    fps: e.fps ?? null,
    lineCount: e.lines?.length ?? null,
    uploadedAt: e.uploadedAt,
    updatedAt: e.updatedAt ?? null,
  };
}

export function caseSummary(c) {
  const exhibits = caseExhibits(c.id);
  return {
    id: c.id,
    caption: c.caption,
    caseNumber: c.caseNumber,
    court: c.court,
    status: c.status,
    countCount: c.counts.length,
    exhibitCount: exhibits.filter((e) => e.status === 'admitted').length,
    ready: readiness(c).ready,
    lastExport: c.exports.at(-1) ?? null,
    updatedAt: c.updatedAt,
  };
}

export function caseView(c) {
  return {
    ...caseSummary(c),
    burden: c.burden,
    counts: c.counts,
    jury: publicJury(c.jury),
    signoff: c.signoff ? { ...c.signoff, fingerprint: undefined, valid: signoffValid(c) } : null,
    exports: c.exports,
    exhibits: caseExhibits(c.id).map(publicExhibit),
    readiness: readiness(c),
    createdAt: c.createdAt,
  };
}

export const touch = (c) => { c.updatedAt = nowIso(); };
