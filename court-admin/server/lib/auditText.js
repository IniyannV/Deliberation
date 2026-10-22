import { db } from '../db.js';

/* Plain-English audit entries for the admin UI and CSV export, computed at read time. */

export function actorName(id) {
  if (id === 'system') return 'System (command line)';
  if (id === 'anonymous') return 'Unknown';
  const u = db.data.users.find((x) => x.id === id);
  return u ? `${u.name} (${u.username})` : id;
}

const caseName = (m) => (m.caseNumber ? `case ${m.caseNumber}` : 'a case');
const exhibit = (m) => `exhibit ${m.exhibitNumber ?? '?'} in ${caseName(m)}`;

export function describe(e) {
  const who = actorName(e.actor);
  const m = e.meta ?? {};
  switch (e.action) {
    case 'auth.login': return `${who} signed in`;
    case 'auth.logout': return `${who} signed out`;
    case 'auth.login_failed': return `Failed sign-in for “${m.username ?? '?'}”`;
    case 'user.created': return `${who} created the ${m.role} account “${m.username}”`;
    case 'user.role_set': return `${who} made “${m.username}” ${m.role === 'admin' ? 'an admin' : 'a clerk'}`;
    case 'user.active_set': return `${who} ${m.active ? 'reactivated' : 'deactivated'} “${m.username}”`;
    case 'user.password_reset': return `${who} reset the password for “${m.username}”`;
    case 'user.password_changed': return `${who} changed their password`;
    case 'case.created': return `${who} created ${caseName(m)}${m.caption ? ` (${m.caption})` : ''}`;
    case 'case.updated': return `${who} edited the details of ${caseName(m)}`;
    case 'case.status_set': return `${who} ${m.status === 'archived' ? 'archived' : 'reopened'} ${caseName(m)}`;
    case 'case.deleted': return `${who} deleted ${caseName(m)}`;
    case 'case.counts_updated': return `${who} updated the charges in ${caseName(m)} (${m.countCount} count${m.countCount === 1 ? '' : 's'})`;
    case 'case.jury_updated': return `${who} changed the jury seats in ${caseName(m)}`;
    case 'case.pins_generated': return `${who} generated ${m.itemCount} PIN${m.itemCount === 1 ? '' : 's'} for ${caseName(m)}`;
    case 'case.signoff_recorded': return `${who} recorded the exhibit-list sign-off for ${caseName(m)}`;
    case 'case.signoff_cleared': return `${who} cleared the exhibit-list sign-off for ${caseName(m)}`;
    case 'case.exported': return `${who} exported ${caseName(m)} for the jury room (${m.itemCount} exhibits)`;
    case 'case.sent_to_jury': return `${who} sent ${caseName(m)} to the jury iPads (${m.itemCount} exhibits)`;
    case 'exhibit.uploaded': return `${who} uploaded ${exhibit(m)}`;
    case 'exhibit.updated': return `${who} edited ${exhibit(m)}`;
    case 'exhibit.status_set': return `${who} marked ${exhibit(m)} as ${m.status}`;
    case 'exhibit.file_replaced': return `${who} replaced the file for ${exhibit(m)}`;
    case 'exhibit.deleted': return `${who} deleted ${exhibit(m)}`;
    // Package signing was retired; these stay so older log entries still read well.
    case 'package_key.created': return `Package signing key created (fingerprint ${m.fingerprint})`;
    case 'package_key.replaced': return `Package signing key replaced (new fingerprint ${m.fingerprint})`;
    case 'package_key.copied': return `Package signing key copied for a jury laptop (${m.fingerprint})`;
    case 'catalog.updated': return `${who} updated the menu and supplies`;
    case 'audit.exported': return `${who} exported the audit log`;
    case 'seed.demo_created': return 'Demo data loaded';
    default: return `${who}: ${e.action}`;
  }
}

export const withSummary = (e) => ({ ...e, actorName: actorName(e.actor), summary: describe(e) });
