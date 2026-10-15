import { useState } from 'react'
import { api } from '../../lib/api'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { fmtTime } from '../../lib/format'
import { cx } from '../../components/ui'
import { Icon } from '../../components/icons'

/**
 * Short back-and-forth between a juror and the bailiff about one request
 * ("We're out of lentil soup, would tomato do?"). `viewer` is 'juror' or 'bailiff'.
 */
export default function RequestThread({ request, viewer }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const messages = request.messages ?? []
  const other = viewer === 'bailiff' ? `Juror ${request.seat}` : 'the bailiff'

  async function send(e) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try {
      const path = viewer === 'bailiff' ? `/admin/requests/${request.id}/messages` : `/requests/${request.id}/messages`
      const { request: updated } = await api(path, { method: 'POST', body: { text } })
      const key = viewer === 'bailiff' ? 'queue' : 'myRequests'
      useLive.setState((s) => ({ [key]: s[key].map((r) => (r.id === updated.id ? updated : r)) }))
      setText('')
    } catch (err) {
      toast(err.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      {messages.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2" aria-label="Messages">
          {messages.map((m) => {
            const mine = m.from === viewer
            return (
              <li key={m.id} className={cx('flex flex-col', mine ? 'items-end' : 'items-start')}>
                <span className={cx('max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-wrap', mine ? 'rounded-br-sm bg-accent text-accent-ink' : 'rounded-bl-sm bg-surface-2')}>{m.text}</span>
                <span className="mt-0.5 text-xs text-muted">{mine ? 'You' : m.from === 'bailiff' ? 'Bailiff' : `Juror ${request.seat}`} · {fmtTime(m.at)}</span>
              </li>
            )
          })}
        </ul>
      )}
      <form onSubmit={send} className="flex gap-2">
        <label className="sr-only" htmlFor={`msg-${request.id}`}>Message {other}</label>
        <input
          id={`msg-${request.id}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder={`Message ${other}…`}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-base focus:border-accent focus:outline-none"
        />
        <button type="submit" disabled={busy || !text.trim()} className="rounded-lg bg-accent px-3 text-accent-ink disabled:opacity-40" aria-label="Send message">
          <Icon name="send" size={18} />
        </button>
      </form>
    </div>
  )
}
