import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../store/auth'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { REQUEST_LABEL, STATUS_LABEL, timeAgo } from '../../lib/format'
import { Badge, Button, Card, EmptyState, ErrorText, Field, Input, PageHeader, Segmented, Textarea, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import RequestThread from './RequestThread'

const TEMPLATES = [
  { type: 'break', icon: 'coffee', title: 'Take a break', text: 'Ask for a short recess.' },
  { type: 'meal', icon: 'utensils', title: 'Order a meal', text: 'Choose from today’s menu.' },
  { type: 'supplies', icon: 'box', title: 'Supplies', text: 'Notepads, pens, water and more.' },
  { type: 'judge_question', icon: 'question', title: 'Question for the judge', text: 'Sent by the foreperson on behalf of the jury.', foreperson: true },
]

export const STATUS_TONE = { pending: 'warn', acknowledged: 'accent', fulfilled: 'ok' }

export function RequestSummary({ r }) {
  const p = r.payload
  if (r.type === 'break') return <p>{p.minutes}-minute break</p>
  if (r.type === 'judge_question') return <p className="whitespace-pre-wrap">{p.text}</p>
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
      toast('Your request was sent to the bailiff.')
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {type === 'break' && (
        <div>
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
      {type === 'judge_question' && (
        <Field label="Your question" hint="The bailiff delivers this to the judge exactly as written. Don't reveal how the jury is divided.">
          {(id) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} required className="min-h-40" />}
        </Field>
      )}
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={busy}>Send request</Button>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  )
}

export default function RequestsPage() {
  const role = useAuth((s) => s.user?.role)
  const mine = useLive((s) => s.myRequests)
  const [active, setActive] = useState(null)
  const [catalog, setCatalog] = useState({ menu: [], supplies: [] })

  useEffect(() => { api('/requests/options').then(setCatalog).catch(() => {}) }, [active])

  const templates = TEMPLATES.filter((t) => !t.foreperson || role === 'foreperson')

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_24rem]">
      <div>
        <PageHeader title="Requests" subtitle="Ask the bailiff for a break, a meal, supplies, or (foreperson only) send a question to the judge. You can message the bailiff about any request." />
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
          <Card className="p-6">
            <h2 className="mb-5 text-xl font-bold">{REQUEST_LABEL[active]}</h2>
            <RequestForm type={active} catalog={catalog} onDone={() => setActive(null)} />
          </Card>
        )}
      </div>

      <aside>
        <h2 className="mb-4 text-xl font-bold">Your requests</h2>
        {mine.length ? (
          <ul className="flex flex-col gap-3">
            {mine.map((r) => (
              <li key={r.id}>
                <Card className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-bold">{REQUEST_LABEL[r.type]}</span>
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </div>
                  <RequestSummary r={r} />
                  <p className="mt-2 text-sm text-muted">Sent {timeAgo(r.createdAt)}</p>
                  <RequestThread request={r} viewer="juror" />
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="bell" title="No requests yet" />
        )}
      </aside>
    </div>
  )
}
