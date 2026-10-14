const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const dateShortFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

export const fmtDate = (v) => dateFmt.format(new Date(v))
export const fmtDay = (v) => dateShortFmt.format(new Date(v))
export const fmtTime = (v) => timeFmt.format(new Date(v))
export const fmtDateTime = (v) => `${fmtDate(v)}, ${fmtTime(v)}`

/** "YYYY-MM-DD" (a calendar date with no time) formatted without timezone drift. */
export const fmtCalendarDate = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return dateFmt.format(new Date(y, m - 1, d))
}

export function timeAgo(v, now = Date.now()) {
  const s = Math.round((now - new Date(v).getTime()) / 1000)
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr ago`
  return fmtDate(v)
}

/** ISO → value for <input type="datetime-local"> in local time. */
export function toLocalInput(iso) {
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const fromLocalInput = (value) => new Date(value).toISOString()

export function fmtBytes(n) {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 ** 2).toFixed(1)} MB`
}

export const PARTY_LABEL = { prosecution: 'Prosecution', defense: 'Defense', joint: 'Joint', court: 'Court' }
export const TYPE_LABEL = { pdf: 'Document (PDF)', image: 'Image', transcript: 'Transcript' }
export const EVENT_TYPES = [
  { id: 'testimony', label: 'Testimony' },
  { id: 'physical', label: 'Physical evidence' },
  { id: 'document', label: 'Document' },
]
export const REQUEST_LABEL = { break: 'Break', meal: 'Meal order', supplies: 'Supplies', judge_question: 'Question for the judge' }
export const STATUS_LABEL = { pending: 'Pending', acknowledged: 'Acknowledged', fulfilled: 'Fulfilled' }
