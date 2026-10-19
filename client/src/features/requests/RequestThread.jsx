import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { fmtTime } from '../../lib/format'
import { cx } from '../../components/ui'
import { Icon } from '../../components/icons'

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()
function dayLabel(v) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (sameDay(v, Date.now())) return 'Today'
  if (sameDay(v, yesterday)) return 'Yesterday'
  return dayFmt.format(new Date(v))
}

// Messages from one sender this close together read as one group: one
// name-and-time line under the last bubble, and the bubbles stack tightly.
const GROUP_GAP = 5 * 60 * 1000
const grouped = (a, b) => a && b && a.from === b.from && sameDay(a.at, b.at) && Math.abs(new Date(b.at) - new Date(a.at)) < GROUP_GAP

/**
 * Message bubbles plus a send box, between one juror (`seat`) and the bailiff.
 * `viewer` is 'juror' or 'bailiff'; `onSend(text)` posts the message.
 * `panel` lays it out as a standalone chat: a scrolling conversation with day
 * headings, the send box along the bottom, and `empty` shown before the first message.
 */
export function MessageThread({ id, messages, viewer, seat, onSend, className, panel = false, empty }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const other = viewer === 'bailiff' ? `Juror ${seat}` : 'the bailiff'
  const scroller = useRef(null)
  const field = useRef(null)

  // Keep the newest message in view, like any messaging app.
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  // The send box grows with what's typed, up to a few lines.
  useEffect(() => {
    const el = field.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px` // plus the border
  }, [text])

  async function send(e) {
    e?.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      await onSend(text.trim())
      setText('')
    } catch (err) {
      toast(err.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  // Return sends; Shift-Return starts a new line.
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e)
  }

  const list = messages.length > 0 && (
    <ul className="flex flex-col" aria-label="Messages">
      {messages.map((m, i) => {
        const prev = messages[i - 1]
        const next = messages[i + 1]
        const mine = m.from === viewer
        const first = !grouped(prev, m)
        const last = !grouped(m, next)
        const newDay = !prev || !sameDay(prev.at, m.at)
        return (
          <li key={m.id} className={cx('flex flex-col', mine ? 'items-end' : 'items-start', i > 0 && (first ? 'mt-3' : 'mt-0.5'))}>
            {newDay && (panel || prev) && (
              <p className="my-2 self-center text-xs font-semibold text-muted">{dayLabel(m.at)}</p>
            )}
            <span
              className={cx(
                'max-w-[85%] rounded-[1.125rem] px-3.5 py-2 leading-snug break-words whitespace-pre-wrap',
                mine ? 'bg-accent text-accent-ink' : 'bg-fill text-ink',
                mine ? cx(!first && 'rounded-tr-md', 'rounded-br-md') : cx(!first && 'rounded-tl-md', 'rounded-bl-md'),
              )}
            >
              {m.text}
            </span>
            {last && (
              <span className="mt-1 px-1 text-xs text-muted">
                {mine ? 'You' : m.from === 'bailiff' ? 'Bailiff' : `Juror ${seat}`} · {fmtTime(m.at)}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )

  const composer = (
    <form onSubmit={send} className={cx('flex items-end gap-2', panel && 'border-t border-line/60 px-4 py-3')}>
      <label className="sr-only" htmlFor={`msg-${id}`}>Message {other}</label>
      <textarea
        ref={field}
        id={`msg-${id}`}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={500}
        placeholder={`Message ${other}…`}
        className="max-h-32 min-w-0 flex-1 resize-none rounded-[1.125rem] border border-line/60 bg-surface px-4 py-[0.4rem] text-base leading-snug placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <button type="submit" disabled={busy || !text.trim()} className="pressable mb-px flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition-colors disabled:bg-fill-strong disabled:text-muted" aria-label="Send message">
        <Icon name="arrowUp" size={18} strokeWidth={2.6} />
      </button>
    </form>
  )

  if (!panel) {
    return (
      <div className={className}>
        {list && <div className="mb-3">{list}</div>}
        {composer}
      </div>
    )
  }

  return (
    <div className={cx('flex flex-col', className)}>
      <div ref={scroller} className="min-h-56 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin" aria-live="polite">
        {list || <div className="flex h-full min-h-48 flex-col items-center justify-center text-center text-muted">{empty}</div>}
      </div>
      {composer}
    </div>
  )
}

/**
 * Short back-and-forth between a juror and the bailiff about one request
 * ("We're out of lentil soup, would tomato do?"). `viewer` is 'juror' or 'bailiff'.
 */
export default function RequestThread({ request, viewer }) {
  async function send(text) {
    const path = viewer === 'bailiff' ? `/admin/requests/${request.id}/messages` : `/requests/${request.id}/messages`
    const { request: updated } = await api(path, { method: 'POST', body: { text } })
    const key = viewer === 'bailiff' ? 'queue' : 'myRequests'
    useLive.setState((s) => ({ [key]: s[key].map((r) => (r.id === updated.id ? updated : r)) }))
  }

  return (
    <MessageThread
      id={request.id}
      messages={request.messages ?? []}
      viewer={viewer}
      seat={request.seat}
      onSend={send}
      className="mt-3 border-t border-line pt-3"
    />
  )
}
