export const PARTY_LABEL = { prosecution: 'Prosecution', defense: 'Defense', joint: 'Joint', court: 'Court' }
export const TYPE_LABEL = { pdf: 'Document (PDF)', image: 'Image', transcript: 'Transcript', video: 'Video' }
export const TYPE_ICON = { pdf: 'file', image: 'image', transcript: 'text', video: 'video' }

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export const fmtDateTime = (v) => (v ? dateTime.format(new Date(v)) : '')
// A YYYY-MM-DD date with no time zone shift.
export const fmtCalendarDate = (v) => (v ? date.format(new Date(`${v}T12:00:00`)) : '')

export function fmtBytes(n) {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

export function timeAgo(v) {
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return fmtDateTime(v)
}

// Today's date where the clerk is (toISOString would give the UTC date, a day ahead in the evening).
export function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
