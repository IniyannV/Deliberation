import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { Badge, Button, Card, Modal, PageHeader, Switch, cx } from '../../components/ui'

export default function Jurors() {
  const presence = useLive((s) => s.presence)
  const [seats, setSeats] = useState([])
  const [newPin, setNewPin] = useState(null)
  const [confirm, setConfirm] = useState(null) // { seat, action }
  const [restart, setRestart] = useState(true) // seating an alternate: begin deliberations anew

  const load = () => api('/admin/seats').then(({ seats }) => setSeats(seats))
  useEffect(() => { load() }, [])

  const online = (seat) => presence.find((p) => p.seat === seat)?.online

  async function run() {
    const { seat, action } = confirm
    setConfirm(null)
    try {
      if (action === 'pin') {
        const { pin } = await api(`/admin/seats/${seat.id}/reset-pin`, { method: 'POST' })
        setNewPin({ seat: seat.seat, pin })
      }
      if (action === 'foreperson') await api(`/admin/seats/${seat.id}`, { method: 'PATCH', body: { isForeperson: true } })
      if (action === 'deactivate') await api(`/admin/seats/${seat.id}`, { method: 'PATCH', body: { active: false } })
      if (action === 'activate') await api(`/admin/seats/${seat.id}`, { method: 'PATCH', body: { active: true } })
      if (action === 'substitute') {
        const { pin, wasForeperson } = await api(`/admin/seats/${seat.id}/substitute`, { method: 'POST', body: { restart } })
        setNewPin({ seat: seat.seat, pin, alternate: true, wasForeperson })
      }
      load()
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  const MESSAGES = {
    pin: (s) => `Juror ${s.seat} will be signed out on every device and will need the new PIN.`,
    foreperson: (s) => `Juror ${s.seat} becomes foreperson. The current foreperson loses foreperson controls immediately.`,
    deactivate: (s) => `Juror ${s.seat} will be signed out and won't count toward polls and ballots (for example, an excused juror). Any open poll or ballot is voided.`,
    activate: (s) => `Juror ${s.seat} will be able to sign in again. Any open poll or ballot is voided.`,
    substitute: (s) => (
      <div className="flex flex-col gap-4">
        <p>An alternate takes over seat {s.seat} with a new PIN. They start fresh: they won’t see the previous juror’s private notes, requests, chat or messages from home.{s.isForeperson && ' This seat is the foreperson, so choose a new foreperson afterwards.'} Any open poll or ballot is voided.</p>
        <label className="flex items-center justify-between gap-4 rounded-xl bg-fill/50 px-4 py-3">
          <span>
            <span className="block font-semibold">Restart deliberations</span>
            <span className="block text-sm text-muted">Clears the shared timeline, exhibit notes, transcript links and every vote, and asks the jury on the room display to begin again. Follow the judge’s instruction.</span>
          </span>
          <Switch checked={restart} onChange={setRestart} label="Restart deliberations" />
        </label>
      </div>
    ),
  }

  return (
    <div>
      <PageHeader title="Juror seats" subtitle="Assign PINs, choose the foreperson, excuse seats and seat alternates. PINs are stored only as hashes. A new PIN is shown once." />
      <Card data-tour="admin-seats">
        <table className="apple-table w-full text-left">
          <thead className="border-b border-line text-sm text-muted">
            <tr><th className="px-5 py-3">Seat</th><th className="py-3">Status</th><th className="py-3">Role</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {seats.map((s) => (
              <tr key={s.id} className={cx(!s.active && 'opacity-60')}>
                <td className="px-5 py-3 text-xl font-bold">{s.seat}</td>
                <td className="py-3">
                  {!s.active ? <Badge>Excused</Badge> : online(s.seat) ? <Badge tone="ok">Online</Badge> : <Badge>Offline</Badge>}
                </td>
                <td className="py-3">{s.isForeperson ? <Badge tone="accent">Foreperson</Badge> : <span className="text-muted">Juror</span>}</td>
                <td className="py-3 pr-4 text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setConfirm({ seat: s, action: 'pin' })}>Reset PIN</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setRestart(true); setConfirm({ seat: s, action: 'substitute' }) }}>Seat an alternate</Button>
                  {s.active && !s.isForeperson && <Button size="sm" variant="ghost" onClick={() => setConfirm({ seat: s, action: 'foreperson' })}>Make foreperson</Button>}
                  {s.active
                    ? <Button size="sm" variant="ghost" onClick={() => setConfirm({ seat: s, action: 'deactivate' })}>Excuse</Button>
                    : <Button size="sm" variant="ghost" onClick={() => setConfirm({ seat: s, action: 'activate' })}>Reinstate</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.action === 'substitute' ? `Seat an alternate in seat ${confirm.seat.seat}` : 'Please confirm'} footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="primary" onClick={run}>Confirm</Button></>}>
        {confirm && (confirm.action === 'substitute' ? MESSAGES.substitute(confirm.seat) : <p>{MESSAGES[confirm.action](confirm.seat)}</p>)}
      </Modal>

      <Modal open={!!newPin} onClose={() => setNewPin(null)} title={`New PIN for seat ${newPin?.seat}`} footer={<Button variant="primary" onClick={() => setNewPin(null)}>I’ve written it down</Button>}>
        <p className="mb-4 text-muted">Give this to the {newPin?.alternate ? 'alternate' : 'juror'} privately. It won’t be shown again.</p>
        {newPin?.wasForeperson && <p className="mb-4 font-semibold text-warn">This seat was the foreperson. Choose a new foreperson, as the judge directs.</p>}
        <p className="rounded-2xl bg-fill py-6 text-center font-mono text-5xl tracking-[0.3em] tabular-nums">{newPin?.pin}</p>
      </Modal>
    </div>
  )
}
