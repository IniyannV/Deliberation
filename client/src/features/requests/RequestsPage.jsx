import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../store/auth'
import { unreadChat, unreadRequestReplies, useLive } from '../../store/live'
import { toast, useUi } from '../../store/ui'
import { JURY_TYPES, REQUEST_LABEL, STATUS_LABEL, fmtTime, timeAgo } from '../../lib/format'
import { Badge, Button, Card, CountBadge, EmptyState, ErrorText, Field, Input, PageHeader, Segmented, Textarea, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import RequestThread from './RequestThread'

const TEMPLATES = [
  { type: 'break', icon: 'coffee', title: 'Take a break', text: 'Ask for a short recess.' },
  { type: 'meal', icon: 'utensils', title: 'Order a meal', text: 'Choose from today’s menu.' },
  { type: 'supplies', icon: 'box', title: 'Supplies', text: 'Notepads, pens, water and more.' },
  { type: 'judge_question', icon: 'question', title: 'Question for the judge', text: 'Sent by the foreperson on behalf of the jury.', foreperson: true },
  { type: 'verdict', icon: 'scale', title: 'We have a verdict', text: 'Tell the court the jury has reached a verdict on every count.', foreperson: true },
]

export const STATUS_TONE = { pending: 'warn', acknowledged: 'accent', fulfilled: 'ok' }

/** The court's response to a jury question, once the bailiff has recorded it. */
export function CourtAnswer({ answer }) {
  if (!answer) return null
  return (
    <div className="mt-3 rounded-xl bg-accent-soft px-4 py-3">
      <p className="mb-1 text-sm font-semibold text-accent">The court’s answer · {fmtTime(answer.at)}</p>
      {answer.mode === 'written'
        ? <p className="whitespace-pre-wrap">{answer.text}</p>
        : <p>The judge will answer this question in the courtroom.{answer.text && ` ${answer.text}`}</p>}
    </div>
  )
}

export function RequestSummary({ r }) {
  const p = r.payload
  if (r.type === 'break') return <p>{p.minutes}-minute break</p>
  if (r.type === 'verdict') return <p>The jury has reached a verdict. The foreperson keeps the signed verdict form until the court asks for it.</p>
  if (r.type === 'judge_question') return <><p className="whitespace-pre-wrap">{p.text}</p><CourtAnswer answer={r.answer} /></>
  return (
    <div>
      <ul className="list-inside list-disc">{p.items.map((it) => <li key={it.id}>{it.qty > 1 ? `${it.qty} × ` : ''}{it.name}</li>)}</ul>
      {p.note && <p className="mt-1 text-muted">Note: {p.note}</p>}
    </div>
  )
}

function ItemPicker({ items, value, onChange, grouped }) {
  const groups = grouped ? Object.groupBy?.(items, (i) => i.category) ?? { All: items } : { '': items }
  const qty = (id) => value[id] ?? 0
  const setQty = (id, n) => onChange({ ...value, [id]: Math.max(0, Math.min(5, n)) })
  return (
    <div className="flex flex-col gap-4">
      {Object.entries(groups).map(([group, list]) => (
        <div key={group}>
          {group && <h4 className="mb-2 text-[0.8125rem] font-semibold text-muted">{group}</h4>}
          <ul className="grid gap-2 sm:grid-cols-2">
            {list.map((it) => (
              <li key={it.id} className={cx('flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors', qty(it.id) ? 'border-accent bg-accent-soft' : 'border-transparent bg-fill')}>
                <span>
                  {it.name}
                  {it.dietary && <span className="block text-sm text-muted">{it.dietary}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2.5">
                  <span className="w-5 text-center font-semibold tabular-nums" aria-label={`${qty(it.id)} selected`}>{qty(it.id) || ''}</span>
                  <span className="flex items-center rounded-lg bg-surface shadow-card">
                    <button type="button" className="flex h-8 w-11 items-center justify-center rounded-l-lg text-ink active:bg-fill disabled:text-muted/50" disabled={!qty(it.id)} onClick={() => setQty(it.id, qty(it.id) - 1)} aria-label={`One fewer ${it.name}`}><Icon name="minus" size={16} strokeWidth={2.2} /></button>
                    <span className="h-4 w-px bg-line" aria-hidden />
                    <button type="button" className="flex h-8 w-11 items-center justify-center rounded-r-lg text-ink active:bg-fill" onClick={() => setQty(it.id, qty(it.id) + 1)} aria-label={`One more ${it.name}`}><Icon name="plus" size={16} strokeWidth={2.2} /></button>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function RequestForm({ type, catalog, onDone }) {
  const [minutes, setMinutes] = useState(15)
  const [picked, setPicked] = useState({})
  const [note, setNote] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const items = Object.entries(picked).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty }))
    const body = { type }
    if (type === 'break') body.minutes = minutes
    if (type === 'meal' || type === 'supplies') Object.assign(body, { items, note })
    if (type === 'judge_question') body.text = text
    try {
      await api('/requests', { method: 'POST', body })
      toast(type === 'verdict' ? 'The bailiff has been told the jury has reached a verdict.' : 'Your request was sent to the bailiff.')
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={cx('flex flex-col gap-5', type === 'break' && 'items-center text-center')}>
      {type === 'break' && (
        <div className="flex flex-col items-center">
          <p className="mb-2 font-semibold">How long?</p>
          <Segmented label="Break length" value={minutes} onChange={setMinutes} options={[5, 10, 15, 30].map((m) => ({ value: m, label: `${m} min` }))} />
        </div>
      )}
      {type === 'meal' && <ItemPicker items={catalog.menu} value={picked} onChange={setPicked} grouped />}
      {type === 'supplies' && <ItemPicker items={catalog.supplies} value={picked} onChange={setPicked} />}
      {(type === 'meal' || type === 'supplies') && (
        <Field label="Note (optional)" hint="Allergies or anything the bailiff should know.">
          {(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />}
        </Field>
      )}
      {type === 'verdict' && (
        <div className="flex flex-col gap-3">
          <p>Send this only when the jury has agreed on every count and the foreperson has filled in and signed the verdict form.</p>
          <p className="text-muted">The bailiff is told only that a verdict has been reached, never what it is. Keep the signed form with you; the verdict is read in the courtroom.</p>
        </div>
      )}
      {type === 'judge_question' && (
        <Field label="Your question" hint="The bailiff delivers this to the judge exactly as written. Don't reveal how the jury is divided.">
          {(id) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} required className="min-h-40" />}
        </Field>
      )}
      <ErrorText>{error}</ErrorText>
      <div className={cx('flex gap-2', type === 'break' && 'justify-center')}>
        <Button type="submit" variant="primary" disabled={busy}>{type === 'verdict' ? 'Tell the court' : 'Send request'}</Button>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  )
}

export default function RequestsPage() {
  const role = useAuth((s) => s.user?.role)
  const seat = useAuth((s) => s.user?.seat)
  const visible = useLive((s) => s.myRequests)
  const juryNotes = visible.filter((r) => JURY_TYPES.includes(r.type))
  const mine = visible.filter((r) => !JURY_TYPES.includes(r.type))
  const [active, setActive] = useState(null)
  const [catalog, setCatalog] = useState({ menu: [], supplies: [] })

  // Being on this page counts as having seen the bailiff's replies to requests,
  // including ones that arrive while it's open.
  const replies = useLive(unreadRequestReplies)
  useEffect(() => { if (replies) useLive.getState().markSeen('requests') }, [replies])

  useEffect(() => { api('/requests/options').then(setCatalog).catch(() => {}) }, [active])

  const templates = TEMPLATES.filter((t) => !t.foreperson || role === 'foreperson')

  return (
    <div>
      <div className="grid gap-8 xl:grid-cols-[1fr_24rem]">
        <div>
          <PageHeader title="Requests" subtitle="Ask the bailiff for a break, a meal or supplies. The foreperson can also send the judge a question, or tell the court the jury has reached a verdict. You can message the bailiff about any request." />
          {!active ? (
            <div className="grid gap-4 sm:grid-cols-2" data-tour="request-templates">
              {templates.map((t) => (
                <button key={t.type} type="button" onClick={() => setActive(t.type)} className="pressable pressable-soft flex items-start gap-4 rounded-2xl bg-surface p-5 text-left shadow-card hover:shadow-[var(--shadow-lift)]">
                  <span className="rounded-xl bg-accent-soft p-3 text-accent"><Icon name={t.icon} size={26} /></span>
                  <span>
                    <span className="block text-lg font-bold">{t.title}</span>
                    <span className="text-muted">{t.text}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <Card className={cx('p-6', active === 'break' && 'text-center')}>
              <h2 className="mb-5 text-xl font-bold">{REQUEST_LABEL[active]}</h2>
              <RequestForm type={active} catalog={catalog} onDone={() => setActive(null)} />
            </Card>
          )}
        </div>

        <aside>
          <BailiffChat />
          {juryNotes.length > 0 && (
            <>
              <h2 className="mt-8 mb-1 text-xl font-bold">The jury’s notes to the court</h2>
              <p className="mb-4 text-sm text-muted">Sent by the foreperson. Every juror sees these and the court’s answers.</p>
              <RequestList list={juryNotes} seat={seat} />
            </>
          )}
          <h2 className="mt-8 mb-4 text-xl font-bold">Your requests</h2>
          {mine.length ? <RequestList list={mine} seat={seat} /> : <EmptyState icon="bell" title="No requests yet" />}
        </aside>
      </div>
    </div>
  )
}

function RequestList({ list, seat }) {
  return (
    <ul className="flex flex-col gap-3">
      {list.map((r) => (
        <li key={r.id}>
          <Card className={cx('p-4', r.type === 'verdict' && 'border-accent')}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-bold">{REQUEST_LABEL[r.type]}</span>
              <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
            </div>
            <RequestSummary r={r} />
            <p className="mt-2 text-sm text-muted">Sent {r.seat === seat ? '' : `by Juror ${r.seat} `}{timeAgo(r.createdAt)}</p>
            <RequestThread request={r} viewer="juror" readOnly={r.seat !== seat} />
          </Card>
        </li>
      ))}
    </ul>
  )
}

/** The open line to the bailiff lives in a floating window; this opens it. */
function BailiffChat() {
  const unread = useLive(unreadChat)
  const { chatOpen, openChat } = useUi()

  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-b from-[#3b8cff] to-[#0062d6] text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.4)]">
        <Icon name="chat" size={20} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 leading-tight font-bold">Chat with the bailiff <CountBadge count={unread} /></h2>
        <p className="text-sm text-muted">For anything that isn’t a request. Stays open as you move around.</p>
      </div>
      <Button size="sm" variant={chatOpen ? 'secondary' : 'primary'} onClick={() => openChat()} disabled={chatOpen}>
        {chatOpen ? 'Chat open' : 'Open chat'}
      </Button>
    </Card>
  )
}
