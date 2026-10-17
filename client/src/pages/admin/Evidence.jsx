import { useRef, useState } from 'react'
import { api } from '../../lib/api'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { PARTY_LABEL, TYPE_LABEL, fmtBytes, fmtCalendarDate } from '../../lib/format'
import { Badge, Button, Card, ErrorText, Field, Input, Modal, PageHeader, Select, Textarea } from '../../components/ui'

const today = () => new Date().toISOString().slice(0, 10)
const EMPTY = { number: '', title: '', party: 'prosecution', dateAdmitted: today(), description: '' }

function MetaFields({ form, setForm }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  return (
    <>
      <div className="grid grid-cols-[10rem_1fr] gap-4">
        <Field label="Exhibit no.">{(id) => <Input id={id} value={form.number} onChange={set('number')} required maxLength={20} placeholder="P-7" />}</Field>
        <Field label="Title">{(id) => <Input id={id} value={form.title} onChange={set('title')} required maxLength={160} />}</Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Introduced by">
          {(id) => (
            <Select id={id} value={form.party} onChange={set('party')}>
              {Object.entries(PARTY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Date admitted">{(id) => <Input id={id} type="date" value={form.dateAdmitted} onChange={set('dateAdmitted')} required />}</Field>
      </div>
      <Field label="Description (optional)">{(id) => <Textarea id={id} value={form.description} onChange={set('description')} maxLength={1000} className="min-h-20" />}</Field>
    </>
  )
}

export default function Evidence() {
  const exhibits = useLive((s) => s.exhibits)
  const [form, setForm] = useState(EMPTY)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const fileInput = useRef(null)

  async function upload(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const data = new FormData()
    Object.entries(form).forEach(([k, v]) => data.append(k, v))
    data.append('file', file)
    try {
      const { exhibit } = await api('/exhibits', { method: 'POST', form: data })
      toast(`Exhibit ${exhibit.number} uploaded and visible to jurors.`)
      setForm({ ...EMPTY, party: form.party, dateAdmitted: form.dateAdmitted })
      setFile(null)
      fileInput.current.value = ''
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit() {
    try {
      const { number, title, party, dateAdmitted, description } = editing
      await api(`/exhibits/${editing.id}`, { method: 'PATCH', body: { number, title, party, dateAdmitted, description } })
      setEditing(null)
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  async function remove() {
    try {
      await api(`/exhibits/${removing.id}`, { method: 'DELETE' })
      setRemoving(null)
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  return (
    <div>
      <PageHeader title="Evidence" subtitle="Upload exhibits admitted into evidence. Jurors see them immediately. Every upload is recorded in the audit log." />

      <Card className="mb-8 p-6" data-tour="admin-upload">
        <h2 className="mb-4 text-xl font-bold">Add an exhibit</h2>
        <form onSubmit={upload} className="flex flex-col gap-4">
          <Field label="File" hint="PDF, image (PNG, JPEG, WebP, GIF), a plain-text transcript (.txt; lines starting with “Q:” or “NAME:” become speaker turns), or an interactive map or chart (.json; format described in server/lib/interactive.js). 50 MB max.">
            {(id) => <Input id={id} ref={fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.json" onChange={(e) => setFile(e.target.files[0] ?? null)} required className="file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1" />}
          </Field>
          <MetaFields form={form} setForm={setForm} />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" variant="primary" icon="upload" disabled={busy || !file} className="self-start">{busy ? 'Uploading…' : 'Upload exhibit'}</Button>
        </form>
      </Card>

      <h2 className="mb-3 text-xl font-bold">Admitted exhibits ({exhibits.length})</h2>
      <Card>
        <table className="apple-table w-full text-left">
          <thead className="border-b border-line text-sm text-muted">
            <tr><th className="px-5 py-3">No.</th><th className="py-3">Title</th><th className="py-3">Type</th><th className="py-3">Party</th><th className="py-3">Admitted</th><th className="py-3">Size</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {exhibits.map((e) => (
              <tr key={e.id}>
                <td className="px-5 py-3"><Badge tone="accent">{e.number}</Badge></td>
                <td className="py-3 font-semibold">{e.title}</td>
                <td className="py-3 text-muted">{TYPE_LABEL[e.type]}</td>
                <td className="py-3 text-muted">{PARTY_LABEL[e.party]}</td>
                <td className="py-3 text-muted">{fmtCalendarDate(e.dateAdmitted)}</td>
                <td className="py-3 text-muted">{fmtBytes(e.size)}</td>
                <td className="py-3 pr-4 text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing({ ...e, description: e.description ?? '' })}>Edit</Button>
                  <Button size="sm" variant="ghost" icon="trash" onClick={() => setRemoving(e)}>Remove</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.number}`} footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" onClick={saveEdit}>Save</Button></>}>
        {editing && <div className="flex flex-col gap-4"><MetaFields form={editing} setForm={setEditing} /></div>}
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title={`Remove ${removing?.number}?`} footer={<><Button variant="ghost" onClick={() => setRemoving(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Remove exhibit</Button></>}>
        <p>Jurors will no longer see “{removing?.title}”. Use this only if the court orders it withdrawn. The removal is recorded in the audit log.</p>
      </Modal>
    </div>
  )
}
