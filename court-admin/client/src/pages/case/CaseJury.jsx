import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api, isDemoAdminDomain } from '../../lib/api'
import { toast } from '../../store/ui'
import { fmtDateTime, timeAgo } from '../../lib/format'
import { Badge, Button, Card, ErrorText, Field, Input, Modal, Select } from '../../components/ui'
import PinSheet from './PinSheet'

// Short enough to keep the table narrow; the full time is in the tooltip.
const monthDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const setWhen = (v) => {
  if (!v) return 'recently'
  const t = new Date(v).getTime()
  if (Number.isNaN(t)) return 'recently'
  return Date.now() - t < 86_400_000 ? timeAgo(v) : monthDay.format(new Date(v))
}

const PinBadge = ({ p }) => (p?.set ? <span title={p.setAt ? `Set ${fmtDateTime(p.setAt)}` : 'PIN set'}><Badge tone="ok" className="font-normal">Set {setWhen(p.setAt)}</Badge></span> : <Badge tone="warn">No PIN</Badge>)

const namesOf = (jury) => Object.fromEntries((jury?.seats ?? []).map((s) => [s.seat, s.name ?? '']))

export default function CaseJury() {
  const isDemoDomain = isDemoAdminDomain()
  const { kase, setCase } = useOutletContext()
  const jury = {
    seatCount: 12,
    foreperson: 1,
    seats: [],
    bailiff: { login: 'B1', name: 'Bailiff' },
    display: {},
    ...(kase.jury ?? {}),
  }
  const [form, setForm] = useState({
    seatCount: jury.seatCount ?? 12,
    foreperson: jury.foreperson ?? 1,
    bailiffLogin: jury.bailiff?.login ?? 'B1',
    bailiffName: jury.bailiff?.name ?? 'Bailiff',
  })
  const [names, setNames] = useState(() => namesOf(jury))
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [selected, setSelected] = useState(() => new Set()) // 'seat number' | 'bailiff' | 'display'
  const [confirmSelected, setConfirmSelected] = useState(false)
  const dirty = form.seatCount !== jury.seatCount || form.foreperson !== jury.foreperson || form.bailiffLogin !== jury.bailiff.login || form.bailiffName !== jury.bailiff.name
  const namesDirty = jury.seats.some((s) => (names[s.seat] ?? '').trim() !== (s.name ?? ''))

  const synced = (c) => {
    setCase(c)
    setNames(namesOf(c.jury))
    setSelected((sel) => new Set([...sel].filter((k) => !/^\d+$/.test(k) || Number(k) <= c.jury.seatCount)))
  }

  async function save(e) {
    e.preventDefault()
    if (isDemoDomain) {
      toast('Public demo domain, so modification not allowed', { tone: 'warn' })
      return
    }
    setError('')
    try {
      const { case: c } = await api(`/cases/${kase.id}/jury`, { method: 'PATCH', body: form })
      synced(c)
      setForm({ seatCount: c.jury.seatCount, foreperson: c.jury.foreperson, bailiffLogin: c.jury.bailiff.login, bailiffName: c.jury.bailiff.name })
      toast('Jury settings saved.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function saveNames({ quiet = false } = {}) {
    if (isDemoDomain) {
      if (!quiet) toast('Public demo domain, so modification not allowed', { tone: 'warn' })
      return false
    }
    try {
      const { case: c } = await api(`/cases/${kase.id}/jury`, { method: 'PATCH', body: { names } })
      synced(c)
      if (!quiet) toast('Juror names saved.')
      return true
    } catch (err) {
      toast(err.message, { tone: 'error' })
      return false
    }
  }

  // `which`: 'all', 'missing', one seat/role, or a list of them for a bulk print.
  async function generate(which) {
    if (isDemoDomain) {
      toast('Public demo domain, so modification not allowed', { tone: 'warn' })
      return
    }
    setConfirmAll(false)
    setConfirmSelected(false)
    // Slips print the names, so unsaved ones are saved first.
    if (namesDirty && !(await saveNames({ quiet: true }))) return
    try {
      const { pins, case: c } = await api(`/cases/${kase.id}/pins`, { method: 'POST', body: { which } })
      synced(c)
      if (Array.isArray(which)) setSelected(new Set())
      if (pins.length) setSheet(pins)
      else toast('Every seat already has a PIN.')
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  const rows = [
    ...(jury.seats ?? []).map((s) => ({ key: String(s.seat), signIn: `${kase.caseNumber}-${s.seat}`, pin: s, seat: s.seat })),
    { key: 'bailiff', signIn: `${kase.caseNumber}-${jury.bailiff?.login ?? 'B1'}`, pin: jury.bailiff ?? { set: false }, who: `Bailiff (${jury.bailiff?.name ?? 'Bailiff'})` },
    { key: 'display', signIn: `${kase.caseNumber}-DISPLAY`, pin: jury.display ?? { set: false }, who: 'Room display (projector)' },
  ]
  const missing = rows.filter((r) => !r.pin.set).length
  const allSelected = selected.size === rows.length
  const toggle = (key) => setSelected((sel) => {
    const next = new Set(sel)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const selectedWithPins = rows.filter((r) => selected.has(r.key) && r.pin.set).length
  const printSelected = () => (selectedWithPins ? setConfirmSelected(true) : generate(rows.filter((r) => selected.has(r.key)).map((r) => r.key)))

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Card className="self-start p-6">
        <h2 className="mb-4 text-xl font-bold">Jury room</h2>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Seats">
              {(id) => <Select id={id} value={form.seatCount} onChange={(e) => setForm({ ...form, seatCount: Number(e.target.value), foreperson: Math.min(form.foreperson, Number(e.target.value)) })}>{[6, 7, 8, 9, 10, 11, 12].map((n) => <option key={n} value={n}>{n}</option>)}</Select>}
            </Field>
            <Field label="Foreperson">
              {(id) => <Select id={id} value={form.foreperson} onChange={(e) => setForm({ ...form, foreperson: Number(e.target.value) })}>{Array.from({ length: form.seatCount }, (_, i) => <option key={i + 1} value={i + 1}>Seat {i + 1}{names[i + 1] ? ` · ${names[i + 1]}` : ''}</option>)}</Select>}
            </Field>
          </div>
          <Field label="Bailiff’s sign-in ID" hint="Letters and numbers, e.g. B1. Not just a number: those are juror seats.">{(id) => <Input id={id} value={form.bailiffLogin} onChange={(e) => setForm({ ...form, bailiffLogin: e.target.value })} maxLength={16} required />}</Field>
          <Field label="Bailiff’s name">{(id) => <Input id={id} value={form.bailiffName} onChange={(e) => setForm({ ...form, bailiffName: e.target.value })} maxLength={80} required />}</Field>
          <ErrorText>{error}</ErrorText>
          <Button
            type="submit"
            variant="primary"
            disabled={isDemoDomain || !dirty}
            title={isDemoDomain ? 'Public demo domain, so modification not allowed' : undefined}
            className="self-start"
          >
            Save
          </Button>
          <p className="text-sm text-muted">Alternates aren’t listed here. If one is seated, the bailiff gives them the seat (and a new PIN) on the jury laptop.</p>
        </form>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        {isDemoDomain && (
          <div className="rounded-xl border border-line bg-fill px-4 py-3 text-sm text-muted">
            <b>Public demo domain:</b> modifications and PIN regeneration are not allowed.
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            icon="key"
            onClick={() => generate('missing')}
            disabled={isDemoDomain || !missing}
            title={isDemoDomain ? 'Public demo domain, so modification not allowed' : undefined}
          >
            Generate missing PINs{missing ? ` (${missing})` : ''}
          </Button>
          <Button
            icon="printer"
            onClick={printSelected}
            disabled={isDemoDomain || !selected.size}
            title={isDemoDomain ? 'Public demo domain, so modification not allowed' : undefined}
          >
            Print selected{selected.size ? ` (${selected.size})` : ''}
          </Button>
          <Button
            icon="refresh"
            onClick={() => setConfirmAll(true)}
            disabled={isDemoDomain}
            title={isDemoDomain ? 'Public demo domain, so modification not allowed' : undefined}
          >
            Replace all PINs
          </Button>
          {namesDirty && (
            <Button
              variant="primary"
              className="ml-auto"
              onClick={() => saveNames()}
              disabled={isDemoDomain}
              title={isDemoDomain ? 'Public demo domain, so modification not allowed' : undefined}
            >
              Save names
            </Button>
          )}
        </div>
        <p className="text-sm text-muted">Tick the slips you need and choose <b>Print selected</b> to print them on one sheet. PINs are shown once and stored only as secure hashes, so printing gives the ticked seats new PINs. Names are optional; they print on the slips and greet each juror on their iPad.</p>
        <Card className="overflow-x-auto">
          <table className="apple-table w-full text-left">
            <thead className="border-b border-line text-sm text-muted">
              <tr>
                <th className="w-10 py-3"><input type="checkbox" className="h-4.5 w-4.5 align-middle" checked={allSelected} ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !allSelected }} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.key)))} aria-label="Select every slip" /></th>
                <th className="py-3 whitespace-nowrap">Sign in</th><th className="w-full py-3">Who</th><th className="py-3">PIN</th><th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.key} className={selected.has(r.key) ? 'bg-accent-soft' : undefined}>
                  <td className="py-2.5"><input type="checkbox" className="h-4.5 w-4.5 align-middle" checked={selected.has(r.key)} onChange={() => toggle(r.key)} aria-label={`Select ${r.seat ? `seat ${r.seat}` : r.who}`} /></td>
                  <td className="py-2.5">
                    <span className={r.seat ? 'text-lg font-bold tabular-nums' : 'font-bold'}>{r.signIn}</span>
                    {r.seat === jury.foreperson && <span className="block text-xs font-semibold text-accent">Foreperson</span>}
                  </td>
                  <td className="py-2.5">
                    {r.seat ? <Input value={names[r.seat] ?? ''} onChange={(e) => setNames({ ...names, [r.seat]: e.target.value })} maxLength={80} placeholder={`Juror seat ${r.seat}`} aria-label={`Seat ${r.seat} juror’s name`} className="min-w-32 py-1.5" /> : r.who}
                  </td>
                  <td className="py-2.5 whitespace-nowrap"><PinBadge p={r.pin} /></td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => generate(r.key)}
                      disabled={isDemoDomain}
                      title={isDemoDomain ? 'Public demo domain, so modification not allowed' : undefined}
                    >
                      {r.pin.set ? 'New PIN' : 'Generate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Modal open={confirmAll} onClose={() => setConfirmAll(false)} title="Replace every PIN?" footer={<><Button variant="ghost" onClick={() => setConfirmAll(false)}>Cancel</Button><Button variant="primary" onClick={() => generate('all')}>Replace all</Button></>}>
        <p>Every seat, the bailiff and the room display get new PINs. Slips printed before stop working once the case is sent to the jury iPads again.</p>
      </Modal>

      <Modal open={confirmSelected} onClose={() => setConfirmSelected(false)} title={`Print ${selected.size} new PIN${selected.size === 1 ? '' : 's'}?`} footer={<><Button variant="ghost" onClick={() => setConfirmSelected(false)}>Cancel</Button><Button variant="primary" onClick={() => generate(rows.filter((r) => selected.has(r.key)).map((r) => r.key))}>Replace and print</Button></>}>
        <p>{selectedWithPins} of the ticked slips already {selectedWithPins === 1 ? 'has a PIN' : 'have PINs'}. Printing gives them new ones; their old slips stop working once the case is sent to the jury iPads again.</p>
      </Modal>

      {sheet && <PinSheet kase={kase} pins={sheet} onClose={() => setSheet(null)} />}
    </div>
  )
}
