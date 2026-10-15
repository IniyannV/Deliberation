// Guided-tour steps. `target` matches a data-tour="…" attribute; if it isn't on
// the page (for example an empty list), the step is shown centred instead.

const JUROR = [
  { route: '/juror', title: 'Welcome to the Deliberation Room', body: 'This short tour walks through what the jury can do here. The app stays usable while the tour runs, so try things as you go. Use Next or the arrow keys; Esc ends the tour.' },
  { route: '/juror', target: 'sidebar', title: 'Everything is in the sidebar', body: 'Evidence, the shared timeline, voting, requests to the bailiff and messages from home. The dot at the bottom shows the connection to the court’s own server. Nothing in this app touches the internet.' },
  { route: '/juror/evidence', target: 'locker-search', title: 'Search every exhibit', body: 'Search covers titles, descriptions, every transcript line, and the labels inside interactive maps and charts. Try “glove” or “tower”.' },
  { route: '/juror/evidence', target: 'locker-grid', title: 'The exhibit locker', body: 'Open any exhibit to view it. J-1 is an interactive map with layers, distance measuring and links to related exhibits. P-7 and D-3 are interactive charts. On photos, right-click to pin a note the whole jury can see.' },
  { route: '/juror/review', target: 'review-transcript', title: 'Side-by-side review', body: 'Read a transcript here. Click a line number (Shift-click for a range), then “Add to timeline”. The link icon on a line ties it to an exhibit.' },
  { route: '/juror/review', target: 'review-exhibit', title: 'Compare with any exhibit', body: 'Pick an exhibit here, or click a linked chip in the transcript to jump straight to it. Drag the divider to resize the panes.' },
  { route: '/juror/timeline', target: 'timeline-board', title: 'The shared timeline', body: 'Every juror edits the same timeline, and it syncs live to the room display. Drag a card sideways to change its time, double-click empty space to add an event there, and right-click a card to edit or delete it.' },
  { route: '/juror/timeline', target: 'timeline-controls', title: 'One line or three lanes', body: 'Show one row per kind of event, or everything on a single line. “Compact” squeezes out the extra space between far-apart events.' },
  { route: '/juror/voting', target: 'foreperson-panel', roles: ['foreperson'], title: 'Foreperson controls', body: 'As foreperson you open polls and secret ballots, and choose what the room display shows.' },
  { route: '/juror/voting', target: 'voting-open', title: 'Polls and secret ballots', body: 'Polls are informal check-ins. Ballots are formal and secret: the server records that a seat voted separately from the choice and never links the two. Every ballot explains everything that must be proven for a guilty verdict.' },
  { route: '/juror/requests', target: 'request-templates', title: 'Ask the bailiff', body: 'Breaks, meals and supplies. The foreperson can also send a question to the judge. You can message the bailiff about any request.' },
  { route: '/juror/bulletin', target: 'bulletin', title: 'Messages from home', body: 'Short messages from family, reviewed by the court and passed on by the bailiff. They are one-way: there is no reply.' },
  { target: 'tour-button', title: 'That’s the tour', body: 'Restart it any time from here. To see the court staff’s side, sign out and sign in as B1 (bailiff), or as DISPLAY for the room projector.' },
]

const BAILIFF = [
  { route: '/admin', title: 'The bailiff’s station', body: 'This tour walks through what court staff can do. Staff never see deliberations: no timeline, no votes, no jurors’ notes. Use Next or the arrow keys; Esc ends the tour.' },
  { route: '/admin', target: 'admin-presence', title: 'Juror devices', body: 'Shows which seats are connected to the court server, and nothing about what they’re doing.' },
  { route: '/admin/requests', target: 'admin-queue', title: 'The request queue', body: 'Breaks, meals, supplies and questions for the judge arrive here live, with a soft chime. Acknowledge, mark fulfilled, or message the juror back on any request.' },
  { route: '/admin/evidence', target: 'admin-upload', title: 'Load evidence', body: 'Upload admitted exhibits: PDFs, images, .txt transcripts, or .json interactive maps and charts. Jurors see them instantly.' },
  { route: '/admin/jurors', target: 'admin-seats', title: 'Juror seats', body: 'Reset PINs, choose the foreperson, and excuse a seat. Excused seats stop counting toward ballots.' },
  { route: '/admin/updates', target: 'admin-updates', title: 'Family updates', body: 'Pass on a vetted, text-only message to one juror. It’s one-way and logged with your ID and the time.' },
  { route: '/admin/audit', target: 'audit-list', title: 'Audit log', body: 'Every sign-in, request, status change, family update and evidence change, in plain English, hash-chained so tampering is detected. Export it as CSV. Deliberation content is never logged.' },
  { target: 'tour-button', title: 'That’s the tour', body: 'Restart it any time from here. Sign in as seat 1 to see the foreperson’s view, or DISPLAY for the projector.' },
]

export function stepsFor(role) {
  const list = role === 'bailiff' ? BAILIFF : role === 'juror' || role === 'foreperson' ? JUROR : []
  return list.filter((s) => !s.roles || s.roles.includes(role))
}
