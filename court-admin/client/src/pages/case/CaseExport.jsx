import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api, isDemoAdminDomain } from '../../lib/api'
import { toast } from '../../store/ui'
import { fmtBytes, fmtCalendarDate, fmtDateTime, today } from '../../lib/format'
import { Button, Card, ErrorText, Field, Input, Modal } from '../../components/ui'
import { Icon } from '../../components/icons'

function Checklist({ readiness }) {
  const checks = readiness?.checks ?? []
  return (
    <ul className="divide-y divide-line">
      {checks.map((c) => (
        <li key={c.key} className="flex items-start gap-3 px-5 py-3">
          <Icon name={c.ok ? 'checkCircle' : 'alert'} size={20} className={c.ok ? 'mt-0.5 text-ok' : 'mt-0.5 text-warn'} />
          <div>
            <p className="font-medium">{c.label}</p>
            {c.detail && <p className="text-sm text-muted">{c.detail}</p>}
          </div>
        </li>
      ))}
    </ul>
  )
}

function Signoff({ kase, setCase }) {
  const s = kase.signoff
  const [form, setForm] = useState({ judge: s?.judge ?? '', prosecution: s?.prosecution ?? '', defense: s?.defense ?? '', date: today() })
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(!s?.valid)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      const { case: c } = await api(`/cases/${kase.id}/signoff`, { method: 'POST', body: form })
      setCase(c)
      setEditing(false)
      toast('Sign-off recorded.')
    } catch (err) {
      setError(err.message)
    }
  }

  if (s?.valid && !editing) {
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2 font-semibold text-ok"><Icon name="checkCircle" size={20} /> Approved {fmtCalendarDate(s.date)}</p>
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">Judge</dt><dd>{s.judge}</dd>
          <dt className="text-muted">Prosecution</dt><dd>{s.prosecution}</dd>
          <dt className="text-muted">Defense</dt><dd>{s.defense}</dd>
          <dt className="text-muted">Recorded by</dt><dd>{s.recordedByName}, {fmtDateTime(s.recordedAt)}</dd>
        </dl>
        <Button
          size="sm"
          className="self-start"
          onClick={() => setEditing(true)}
          disabled={isDemoAdminDomain()}
          title={isDemoAdminDomain() ? 'Public demo domain, so modification not allowed' : undefined}
        >
          Record again
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {s && !s.valid && <p className="rounded-xl bg-warn-soft px-3.5 py-2.5 text-sm text-warn">The exhibits changed after the last sign-off ({fmtCalendarDate(s.date)}), so it no longer counts. Have the list approved again.</p>}
      <p className="text-sm text-muted">Confirm that the judge and both counsel have approved the list of {kase.exhibitCount} admitted exhibit{kase.exhibitCount === 1 ? '' : 's'} going to the jury room.</p>
      <Field label="Judge">{(id) => <Input id={id} value={form.judge} onChange={set('judge')} required maxLength={120} placeholder="Hon. …" />}</Field>
      <Field label="Prosecution counsel">{(id) => <Input id={id} value={form.prosecution} onChange={set('prosecution')} required maxLength={120} />}</Field>
      <Field label="Defense counsel">{(id) => <Input id={id} value={form.defense} onChange={set('defense')} required maxLength={120} />}</Field>
      <Field label="Date approved">{(id) => <Input id={id} type="date" value={form.date} onChange={set('date')} required />}</Field>
      <ErrorText>{error}</ErrorText>
      <Button
        type="submit"
        variant="primary"
        className="self-start"
        disabled={isDemoAdminDomain() || !kase.exhibitCount}
        title={isDemoAdminDomain() ? 'Public demo domain, so modification not allowed' : undefined}
      >
        Record sign-off
      </Button>
    </form>
  )
}

export default function CaseExport() {
  const { kase, setCase } = useOutletContext()
  const ready = !!kase.readiness?.ready
  const [sending, setSending] = useState(false)
  const [replace, setReplace] = useState(null) // the jury server's message when it still holds another trial

  // Loads the case straight into the jury server on this machine, which serves the jurors' iPads.
  async function send(replaceExisting = false) {
    setReplace(null)
    setSending(true)
    try {
      const { case: c, loaded } = await api(`/cases/${kase.id}/send`, { method: 'POST', body: { replace: replaceExisting } })
      setCase(c)
      toast(`${loaded.caseNumber} is on the jury iPads: ${loaded.exhibitCount} exhibits, ${loaded.seatCount} seats.`)
    } catch (err) {
      if (err.status === 409) setReplace(err.message)
      else toast(err.message, { tone: 'error' })
    } finally {
      setSending(false)
    }
  }

  // The copy is a plain file download. Refresh afterwards so it appears in the history.
  function downloaded() {
    toast('Your browser is downloading the case package.')
    setTimeout(() => api(`/cases/${kase.id}`).then(({ case: c }) => setCase(c)).catch(() => {}), 4000)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="px-5 pt-5 text-xl font-bold">Ready for the jury room?</h2>
          <Checklist readiness={kase.readiness} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-xl font-bold">Exhibit-list sign-off</h2>
          <Signoff kase={kase} setCase={setCase} />
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <h2 className="mb-2 text-xl font-bold">Send to the jury iPads</h2>
          <p className="mb-4 text-muted">Loads the case, its charges, the {kase.exhibitCount} admitted exhibits, the jury PINs (as hashes only) and the menu into the jury server on this machine. Jurors see it on their iPads as soon as they sign in with the PINs on the printed sheet.</p>
          {ready ? (
            <Button
              variant="primary"
              size="lg"
              icon="send"
              onClick={() => send()}
              disabled={isDemoAdminDomain() || sending}
              title={isDemoAdminDomain() ? 'Public demo domain, so modification not allowed' : undefined}
            >
              {sending ? 'Sending…' : `Send ${kase.caseNumber} to jury iPads`}
            </Button>
          ) : (
            <p className="flex items-center gap-2 rounded-xl bg-fill px-4 py-3 text-muted"><Icon name="info" size={18} /> Finish the checklist to send the case.</p>
          )}
          <p className="mt-4 text-sm text-muted">Multiple court cases can be pushed simultaneously. If this same trial was already sent with active deliberations, confirming will update its exhibits and settings. The jury server must be running (<code className="font-mono">npm start</code>).</p>
        </Card>

        {ready && (
          <Card className="p-6">
            <h2 className="mb-2 text-lg font-bold">Jury laptop on another machine?</h2>
            <p className="text-sm text-muted">
              <a href={`/api/cases/${kase.id}/export`} onClick={downloaded} className="font-semibold text-accent hover:underline"><Icon name="download" size={16} className="mr-1 inline align-[-3px]" />Download a copy</a> and load it there, with its jury server stopped:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-fill px-3 py-2 font-mono text-xs">npm run import-case -- /Volumes/USB/{kase.caseNumber.replace(/[^\w.-]+/g, '_')}.jurycase.tar</pre>
          </Card>
        )}

        {kase.exports.length > 0 && (
          <Card>
            <h2 className="px-5 pt-5 text-lg font-bold">History</h2>
            <ul className="divide-y divide-line">
              {[...kase.exports].reverse().map((x) => (
                <li key={x.at} className="flex justify-between gap-3 px-5 py-3 text-sm">
                  <span>{fmtDateTime(x.at)} · {x.method === 'sent' ? 'Sent to jury iPads' : 'Downloaded'} · {x.byName}</span>
                  <span className="text-muted">{x.exhibitCount} exhibits · {fmtBytes(x.bytes)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <Modal open={!!replace} onClose={() => setReplace(null)} title="Replace the trial on the jury iPads?" footer={<><Button variant="ghost" onClick={() => setReplace(null)}>Cancel</Button><Button variant="danger" onClick={() => send(true)}>Replace it</Button></>}>
        <p>{replace}</p>
        <p className="mt-3">Replacing clears that trial’s deliberations from the jury server. Its audit log is archived, not deleted.</p>
      </Modal>
    </div>
  )
}
