import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { chatUnread, useLive } from '../../store/live'
import { toast, useUi } from '../../store/ui'
import { REQUEST_LABEL, STATUS_LABEL, fmtTime, timeAgo } from '../../lib/format'
import { Badge, Button, Card, EmptyState, ErrorText, Field, IconButton, PageHeader, Segmented, Textarea, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import { RequestSummary, STATUS_TONE } from '../../features/requests/RequestsPage'
import RequestThread, { MessageThread } from '../../features/requests/RequestThread'

const ICON = { break: 'coffee', meal: 'utensils', supplies: 'box', judge_question: 'question', verdict: 'scale' }
const NEXT = { pending: ['acknowledged', 'Acknowledge'], acknowledged: ['fulfilled', 'Mark fulfilled'] }

export default function Requests() {
  const { queue, alertAt, soundOn, setSound } = useLive()
  const [filter, setFilter] = useState('active')
  const [flash, setFlash] = useState(false)
  const [, setNow] = useState(0)

  // Gentle visual alert for new requests (no flashing, just a soft highlight that fades).
  useEffect(() => {
    if (!alertAt) return
    setFlash(true)
    const id = setTimeout(() => setFlash(false), 4000)
    return () => clearTimeout(id)
  }, [alertAt])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  async function advance(r) {
    const [status] = NEXT[r.status]
    try {
      const { request } = await api(`/admin/requests/${r.id}`, { method: 'PATCH', body: { status } })
      useLive.setState((s) => ({ queue: s.queue.map((x) => (x.id === r.id ? request : x)) }))
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  const list = queue.filter((r) => (filter === 'active' ? r.status !== 'fulfilled' : true))
  const newest = queue[0]?.id

  return (
    <div>
      <PageHeader
        title="Request queue"
        subtitle="Live requests from the jury room. Reply to a juror on any request. Status changes and messages are recorded in the audit log (message text is not)."
        actions={<>
          <Button size="sm" variant={soundOn ? 'secondary' : 'ghost'} icon="volume" onClick={() => setSound(!soundOn)} aria-pressed={soundOn}>
            Sound {soundOn ? 'on' : 'off'}
          </Button>
          <Segmented label="Show" value={filter} onChange={setFilter} options={[{ value: 'active', label: 'Active' }, { value: 'all', label: 'All' }]} />
        </>}
      />

      {list.length ? (
        <ul className="flex flex-col gap-3" data-tour="admin-queue">
          {list.map((r) => (
            <li key={r.id}>
              <Card className={cx('flex items-start gap-5 p-5 transition-colors duration-1000', flash && r.id === newest && r.status === 'pending' ? 'border-warn bg-warn-soft' : '', r.type === 'verdict' && r.status !== 'fulfilled' && 'border-accent ring-2 ring-accent/25', r.status === 'fulfilled' && 'opacity-60')}>
                <span className={cx('rounded-xl p-3', r.status === 'pending' ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-muted')}>
                  <Icon name={ICON[r.type]} size={26} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-3">
                    <span className="text-lg font-bold">Juror {r.seat}</span>
                    <span className="font-semibold">{REQUEST_LABEL[r.type]}</span>
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </div>
                  {r.type === 'verdict'
                    ? <p>The jury has reached a verdict. Tell the judge. The foreperson keeps the signed verdict form until it is read in court; the app does not know what the verdict is.</p>
                    : <RequestSummary r={r} />}
                  {r.type === 'judge_question' && !r.answer && <AnswerForm request={r} />}
                  <p className="mt-2 text-sm text-muted">
                    {r.history.map((h) => `${STATUS_LABEL[h.status]} ${fmtTime(h.at)}`).join(' → ')} · {timeAgo(r.createdAt)}
                  </p>
                  <RequestThread request={r} viewer="bailiff" />
                </div>
                {NEXT[r.status] && (
                  <Button variant={r.status === 'pending' ? 'primary' : 'secondary'} onClick={() => advance(r)}>{NEXT[r.status][1]}</Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="check" title={filter === 'active' ? 'All caught up' : 'No requests yet'}>New requests appear here instantly, with a soft chime.</EmptyState>
      )}

      <JurorChats />
    </div>
  )
}

/**
 * The court's response to a jury question, entered once the judge has
 * decided it with counsel. Every juror sees it; the audit log records only
 * that the question was answered and how.
 */
function AnswerForm({ request }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('written')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { request: updated } = await api(`/admin/requests/${request.id}/answer`, { method: 'POST', body: { mode, text } })
      useLive.setState((s) => ({ queue: s.queue.map((x) => (x.id === updated.id ? updated : x)) }))
      toast('The jury can now see the court’s answer.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return <Button size="sm" variant="secondary" icon="edit" className="mt-3" onClick={() => setOpen(true)}>Record the court’s answer</Button>
  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-3 rounded-xl bg-fill/50 p-4">
      <Segmented label="How the judge is answering" value={mode} onChange={setMode} options={[{ value: 'written', label: 'Written answer' }, { value: 'open_court', label: 'In open court' }]} />
      <Field label={mode === 'written' ? 'The judge’s answer' : 'Note for the jury (optional)'} hint={mode === 'written' ? 'Copy it exactly as the judge wrote it. Every juror will see it.' : 'For example: “Please wait to be brought into the courtroom.”'}>
        {(id) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} maxLength={mode === 'written' ? 4000 : 500} required={mode === 'written'} className="min-h-24" />}
      </Field>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={busy || (mode === 'written' && !text.trim())}>Send to the jury</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  )
}

/** One juror's chat. It counts as read once it's on screen, as in the chat window. */
function ChatCard({ chat: c, onOpen, onSend }) {
  const ref = useRef(null)
  const [onScreen, setOnScreen] = useState(false)
  const unread = useLive((s) => chatUnread(s, c))

  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.5 })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (onScreen && unread) useLive.getState().markChatRead(c.seatId)
  }, [onScreen, unread, c.seatId])

  return (
    <li ref={ref}>
      <Card className={cx('flex h-[26rem] flex-col overflow-hidden', unread && 'border-accent/60')}>
        <div className="flex items-center justify-between gap-2 border-b border-line/60 py-2 pr-2 pl-4">
          <p className="flex items-center gap-2 text-lg font-bold">Juror {c.seat} {unread && <Badge tone="accent">Unread</Badge>}</p>
          <IconButton icon="external" label={`Open Juror ${c.seat}’s chat in a window`} className="text-accent" onClick={onOpen} />
        </div>
        <MessageThread id={`chat-${c.seatId}`} panel messages={c.messages} viewer="bailiff" seat={c.seat} onSend={onSend} className="min-h-0 flex-1" />
      </Card>
    </li>
  )
}

/** Open chats jurors started from their Requests page. */
function JurorChats() {
  const chats = useLive((s) => s.chats)
  const openChat = useUi((s) => s.openChat)

  async function send(seatId, text) {
    const { chat } = await api(`/admin/chats/${seatId}/messages`, { method: 'POST', body: { text } })
    useLive.setState((s) => ({ chats: s.chats.map((c) => (c.seatId === chat.seatId ? chat : c)) }))
  }

  return (
    <section className="mt-10" aria-labelledby="juror-chats">
      <h2 id="juror-chats" className="mb-1 text-xl font-bold">Juror chats</h2>
      <p className="mb-4 text-muted">Messages jurors send you outside of a request. Message text is not recorded in the audit log.</p>
      {chats.length ? (
        <ul className="grid gap-3 lg:grid-cols-2">
          {chats.map((c) => (
            <ChatCard key={c.seatId} chat={c} onOpen={() => openChat(c.seatId)} onSend={(text) => send(c.seatId, text)} />
          ))}
        </ul>
      ) : (
        <EmptyState icon="mail" title="No chats yet">When a juror messages you from their Requests page, it appears here.</EmptyState>
      )}
    </section>
  )
}
