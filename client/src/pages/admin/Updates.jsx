import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { fmtDateTime } from '../../lib/format'
import { Badge, Button, Card, ErrorText, Field, PageHeader, Select, Textarea } from '../../components/ui'

const MAX = 2000

export default function Updates() {
  const updatesVersion = useLive((s) => s.updatesVersion)
  const [seats, setSeats] = useState([])
  const [sent, setSent] = useState([])
  const [seatId, setSeatId] = useState('')
  const [body, setBody] = useState('')
  const [vetted, setVetted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { api('/admin/seats').then(({ seats }) => setSeats(seats.filter((s) => s.active))) }, [])
  useEffect(() => { api('/admin/updates').then(({ updates }) => setSent(updates)) }, [updatesVersion])

  async function send(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { update } = await api('/admin/updates', { method: 'POST', body: { seatId, body } })
      setSent((s) => [update, ...s])
      setBody('')
      setVetted(false)
      toast(`Delivered to Juror ${update.seat}'s bulletin board.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Family updates" subtitle="One-way, text-only messages to a single juror. Jurors can mark them read but can't reply. Each message is logged with your ID and the time." />

      <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
        <Card className="h-fit p-6">
          <h2 className="mb-4 text-xl font-bold">New update</h2>
          <form onSubmit={send} className="flex flex-col gap-4">
            <Field label="To">
              {(id) => (
                <Select id={id} value={seatId} onChange={(e) => setSeatId(e.target.value)} required>
                  <option value="">Choose a seat…</option>
                  {seats.map((s) => <option key={s.id} value={s.id}>Juror {s.seat}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Message" hint={`${body.length} / ${MAX}. Plain text only; links and formatting are not shown.`}>
              {(id) => <Textarea id={id} value={body} onChange={(e) => setBody(e.target.value.slice(0, MAX))} required className="min-h-44" />}
            </Field>
            <label className="flex items-start gap-3 rounded-lg bg-warn-soft px-4 py-3 text-warn">
              <input type="checkbox" checked={vetted} onChange={(e) => setVetted(e.target.checked)} className="mt-1 h-4 w-4" />
              I have reviewed this message. It contains no information about the case, the trial, or media coverage.
            </label>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" variant="primary" disabled={!vetted || !seatId || !body.trim() || busy} className="self-start">Send to juror</Button>
          </form>
        </Card>

        <section>
          <h2 className="mb-3 text-xl font-bold">Sent</h2>
          <ul className="flex flex-col gap-3">
            {sent.map((u) => (
              <li key={u.id}>
                <Card className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                    <span className="font-bold">Juror {u.seat}</span>
                    <span className="flex items-center gap-2 text-muted">
                      {fmtDateTime(u.createdAt)} · {u.bailiffId}
                      {u.readAt ? <Badge tone="ok">Read</Badge> : <Badge>Unread</Badge>}
                    </span>
                  </div>
                  <p className="line-clamp-3 whitespace-pre-wrap text-muted">{u.body}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
