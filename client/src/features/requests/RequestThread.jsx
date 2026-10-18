import { useState } from 'react'
import { api } from '../../lib/api'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { fmtTime } from '../../lib/format'
import { cx } from '../../components/ui'
import { Icon } from '../../components/icons'

/**
 * Message bubbles plus a send box, between one juror (`seat`) and the bailiff.
 * `viewer` is 'juror' or 'bailiff'; `onSend(text)` posts the message.
 */
export function MessageThread({ id, messages, viewer, seat, onSend, className }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const other = viewer === 'bailiff' ? `Juror ${seat}` : 'the bailiff'

  async function send(e) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try {
      await onSend(text)
      setText('')
    } catch (err) {
      toast(err.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      {messages.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2" aria-label="Messages">
          {messages.map((m) => {
            const mine = m.from === viewer
            return (
              <li key={m.id} className={cx('flex flex-col', mine ? 'items-end' : 'items-start')}>
                <span className={cx('max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-wrap', mine ? 'rounded-br-md bg-accent text-accent-ink' : 'rounded-bl-md bg-fill')}>{m.text}</span>
                <span className="mt-0.5 text-xs text-muted">{mine ? 'You' : m.from === 'bailiff' ? 'Bailiff' : `Juror ${seat}`} · {fmtTime(m.at)}</span>
              </li>
            )
          })}
        </ul>
      )}
      <form onSubmit={send} className="flex gap-2">
        <label className="sr-only" htmlFor={`msg-${id}`}>Message {other}</label>
        <input
          id={`msg-${id}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder={`Message ${other}…`}
          className="min-w-0 flex-1 rounded-full border border-transparent bg-fill px-4 py-1.5 text-base placeholder:text-muted focus:border-accent focus:bg-surface focus:outline-none"
        />
        <button type="submit" disabled={busy || !text.trim()} className="pressable flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full bg-accent text-accent-ink disabled:bg-fill-strong disabled:text-muted" aria-label="Send message">
          <Icon name="arrowUp" size={18} strokeWidth={2.6} />
        </button>
      </form>
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
