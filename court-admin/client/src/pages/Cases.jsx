import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, isDemoAdminDomain } from '../lib/api'
import { fmtDateTime, timeAgo } from '../lib/format'
import { Badge, Button, Card, EmptyState, ErrorText, Field, Input, Modal, PageHeader, Segmented, Spinner } from '../components/ui'
import { Icon } from '../components/icons'

export function CaseStatus({ c }) {
  if (c.status === 'archived') return <Badge>Archived</Badge>
  if (c.lastExport?.method === 'sent' || c.exports?.some((x) => x.method === 'sent')) {
    return <Badge tone="ok"><Icon name="check" size={13} strokeWidth={2.5} /> Sent to jury</Badge>
  }
  if (c.ready) return <Badge tone="ok"><Icon name="check" size={13} strokeWidth={2.5} /> Ready to send</Badge>
  return <Badge tone="warn">In preparation</Badge>
}

export default function Cases() {
  const [cases, setCases] = useState(null)
  const [q, setQ] = useState('')
  const [show, setShow] = useState('active')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { api('/cases').then(({ cases }) => setCases(cases)) }, [])

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (cases ?? [])
      .filter((c) => (show === 'archived' ? c.status === 'archived' : c.status !== 'archived'))
      .filter((c) => !term || `${c.caseNumber} ${c.caption} ${c.court}`.toLowerCase().includes(term))
  }, [cases, q, show])

  const isDemoDomain = isDemoAdminDomain()

  return (
    <div>
      <PageHeader
        title="Cases"
        subtitle="Prepare each trial for deliberation: its charges, admitted exhibits and jury PINs. Export a ready case to a file and import it on the jury laptop."
        actions={
          <Button
            variant="primary"
            icon="plus"
            onClick={() => setCreating(true)}
          >
            New case
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-80 max-w-full">
          <Icon name="search" size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search case number, caption or court" className="pl-9" aria-label="Search cases" />
        </div>
        <Segmented label="Show" value={show} onChange={setShow} options={[{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]} />
      </div>

      {!cases ? <Spinner /> : list.length ? (
        <Card>
          <table className="apple-table w-full text-left">
            <thead className="border-b border-line text-sm text-muted">
              <tr><th className="px-5 py-3">Case</th><th className="py-3">Court</th><th className="py-3">Case ID</th><th className="py-3 text-right">Counts</th><th className="py-3 text-right">Exhibits</th><th className="py-3 pl-6">Status</th><th className="py-3 pr-5">Last sent</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/cases/${c.id}`)} className="cursor-pointer hover:bg-fill/50">
                  <td className="px-5 py-3">
                    <p className="font-semibold">{c.caption}</p>
                    <p className="text-sm text-muted tabular-nums">{c.caseNumber}</p>
                  </td>
                  <td className="py-3 text-muted">{c.court || '–'}</td>
                  <td className="py-3 font-mono text-sm text-muted">{c.id}</td>
                  <td className="py-3 text-right tabular-nums">{c.countCount}</td>
                  <td className="py-3 text-right tabular-nums">{c.exhibitCount}</td>
                  <td className="py-3 pl-6"><CaseStatus c={c} /></td>
                  <td className="py-3 pr-5 text-sm text-muted" title={c.lastExport ? fmtDateTime(c.lastExport.at) : undefined}>{c.lastExport ? timeAgo(c.lastExport.at) : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState icon="gavel" title={q ? 'No matching cases' : show === 'archived' ? 'No archived cases' : 'No cases yet'}>
          {!q && show === 'active' && 'Create a case to start preparing it for the jury room.'}
        </EmptyState>
      )}

      <NewCase open={creating} onClose={() => setCreating(false)} onCreated={(c) => navigate(`/cases/${c.id}`)} />
    </div>
  )
}

function NewCase({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ caption: '', caseNumber: '', court: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { case: c } = await api('/cases', { method: 'POST', body: form })
      onCreated(c)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New case" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="new-case" disabled={busy}>Create case</Button></>}>
      <form id="new-case" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Caption" hint="As it appears on the docket, e.g. People v. Dana Whitlock">{(id) => <Input id={id} value={form.caption} onChange={set('caption')} required maxLength={160} autoFocus />}</Field>
        <Field label="Case number">{(id) => <Input id={id} value={form.caseNumber} onChange={set('caseNumber')} required maxLength={40} />}</Field>
        <Field label="Court" hint="Court and part or courtroom">{(id) => <Input id={id} value={form.court} onChange={set('court')} maxLength={160} />}</Field>
        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  )
}
