import { db } from '../db.js';

/*
 * Plain-English descriptions of audit entries for the admin UI and CSV
 * export. Computed at read time; stored entries (and their hash chain) are
 * never changed.
 */

const REQUEST = { break: 'break', meal: 'meal order', supplies: 'supplies request', judge_question: 'question for the judge' };
const STATUS = { pending: 'pending', acknowledged: 'acknowledged', fulfilled: 'fulfilled' };
const EXHIBIT = { pdf: 'PDF', image: 'image', transcript: 'transcript', video: 'video' };

export function actorName(id) {
  if (id === 'system') return 'System';
  if (id === 'anonymous') return 'Unknown device';
  const u = db.data.users.find((x) => x.id === id);
  if (!u) return id;
  if (u.kind === 'juror') return `Juror ${u.seat}`;
  return u.name;
}

const juror = (seat) => (seat ? `Juror ${seat}` : 'a juror');

export function describe(e) {
  const who = actorName(e.actor);
  const m = e.meta ?? {};
  const req = REQUEST[m.requestType] ?? 'request';
  switch (e.action) {
    case 'auth.login': return `${who} signed in`;
    case 'auth.logout': return `${who} signed out`;
    case 'auth.login_failed': return `Failed sign-in attempt for “${m.identifier ?? '?'}”`;
    case 'exhibit.uploaded': return `${who} uploaded exhibit ${m.exhibitNumber} (${EXHIBIT[m.exhibitType] ?? m.exhibitType})`;
    case 'exhibit.updated': return `${who} edited the details of exhibit ${m.exhibitNumber}`;
    case 'exhibit.removed': return `${who} removed exhibit ${m.exhibitNumber}`;
    case 'request.created':
      return m.requestType === 'break' && m.minutes
        ? `${juror(m.seat)} asked for a ${m.minutes}-minute break`
        : `${juror(m.seat)} sent a ${req}${m.itemCount ? ` (${m.itemCount} item${m.itemCount === 1 ? '' : 's'})` : ''}`;
    case 'request.status': return `${who} marked ${juror(m.seat)}’s ${req} as ${STATUS[m.status] ?? m.status}`;
    case 'request.message': return who === juror(m.seat) ? `${who} sent the bailiff a message about their ${req}` : `${who} sent ${juror(m.seat)} a message about their ${req}`;
    case 'update.sent': return `${who} delivered a family update to ${juror(m.seat)}`;
    case 'update.read': return `${juror(m.seat)} read a family update`;
    case 'seat.foreperson_set': return `${who} made ${juror(m.seat)} the foreperson`;
    case 'seat.active_set': return m.active ? `${who} reinstated ${juror(m.seat)}` : `${who} excused ${juror(m.seat)}`;
    case 'seat.pin_reset': return `${who} reset the PIN for ${juror(m.seat)}`;
    case 'catalog.updated': return `${who} updated the meal menu and supplies list`;
    case 'audit.exported': return `${who} exported the audit log`;
    case 'seed.case_created': return 'Demo case loaded';
    default: return `${who}: ${e.action}`;
  }
}

export const withSummary = (e) => ({ ...e, actorName: actorName(e.actor), summary: describe(e) });
