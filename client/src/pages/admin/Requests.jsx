import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { REQUEST_LABEL, STATUS_LABEL, fmtTime, timeAgo } from '../../lib/format'
import { Badge, Button, Card, EmptyState, PageHeader, Segmented, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import { RequestSummary, STATUS_TONE } from '../../features/requests/RequestsPage'
import RequestThread, { MessageThread } from '../../features/requests/RequestThread'

const ICON = { break: 'coffee', meal: 'utensils', supplies: 'box', judge_question: 'question' }
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
              <Card className={cx('flex items-start gap-5 p-5 transition-colors duration-1000', flash && r.id === newest && r.status === 'pending' ? 'border-warn bg-warn-soft' : '', r.status === 'fulfilled' && 'opacity-60')}>
                <span className={cx('rounded-xl p-3', r.status === 'pending' ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-muted')}>
                  <Icon name={ICON[r.type]} size={26} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-3">
                    <span className="text-lg font-bold">Juror {r.seat}</span>
                    <span className="font-semibold">{REQUEST_LABEL[r.type]}</span>
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </div>
                  <RequestSummary r={r} />
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

/** Open chats jurors started from the bottom of their Requests page. */
function JurorChats() {
  const chats = useLive((s) => s.chats)

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
            <li key={c.seatId}>
              <Card className="p-5">
                <p className="mb-3 text-lg font-bold">Juror {c.seat}</p>
                <MessageThread id={`chat-${c.seatId}`} messages={c.messages} viewer="bailiff" seat={c.seat} onSend={(text) => send(c.seatId, text)} />
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="mail" title="No chats yet">When a juror messages you from their Requests page, it appears here.</EmptyState>
      )}
    </section>
  )
}
