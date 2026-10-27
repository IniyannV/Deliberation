import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api, exhibitFileUrl, isDemoAdminDomain, uploadWithProgress } from '../../lib/api'
import { toast } from '../../store/ui'
import { PARTY_LABEL, TYPE_ICON, TYPE_LABEL, fmtBytes, fmtCalendarDate, today } from '../../lib/format'
import { Badge, Button, Card, EmptyState, ErrorText, Field, IconButton, Input, Modal, Select, Spinner, Textarea, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import PdfPreview from '../../components/PdfPreview'

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.mp4,.m4v,.mov,.webm'
const EMPTY = { number: '', title: '', party: 'prosecution', dateAdmitted: today(), description: '' }

function MetaFields({ form, setForm }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  return (
    <>
      <div className="grid grid-cols-[9rem_1fr] gap-4">
        <Field label="Exhibit no.">{(id) => <Input id={id} value={form.number} onChange={set('number')} required maxLength={20} placeholder="P-7" />}</Field>
        <Field label="Title">{(id) => <Input id={id} value={form.title} onChange={set('title')} required maxLength={160} />}</Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Introduced by">
          {(id) => <Select id={id} value={form.party} onChange={set('party')}>{Object.entries(PARTY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}
        </Field>
        <Field label="Date admitted">{(id) => <Input id={id} type="date" value={form.dateAdmitted} onChange={set('dateAdmitted')} required />}</Field>
      </div>
      <Field label="Description (optional)">{(id) => <Textarea id={id} value={form.description} onChange={set('description')} maxLength={1000} className="min-h-20" />}</Field>
    </>
  )
}

function Progress({ value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${value * 100}%` }} />
      </div>
      <span className="w-12 text-right text-sm text-muted tabular-nums">{Math.round(value * 100)}%</span>
    </div>
  )
}

function UploadCard({ kase, setCase, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const input = useRef(null)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setProgress(0)
    const data = new FormData()
    Object.entries(form).forEach(([k, v]) => data.append(k, v))
    data.append('file', file)
    try {
      const { exhibit, case: c } = await uploadWithProgress(`/cases/${kase.id}/exhibits`, data, setProgress)
      setCase(c)
      toast(`Exhibit ${exhibit.number} added.`)
      setForm({ ...EMPTY, party: form.party, dateAdmitted: form.dateAdmitted })
      setFile(null)
      input.current.value = ''
    } catch (err) {
      setError(err.message)
    } finally {
      setProgress(null)
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Add an admitted exhibit</h2>
        {onClose && <IconButton icon="x" label="Close" onClick={onClose} disabled={progress !== null} />}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="File" hint="PDF, image (PNG, JPEG, WebP, GIF), a .txt transcript (lines starting “Q:”, “A:” or “NAME:” become speaker turns), or video (MP4, MOV, WebM). Up to 2 GB. Files are checked by their content.">
          {(id) => <Input id={id} ref={input} type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files[0] ?? null)} required className="file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1" />}
        </Field>
        <MetaFields form={form} setForm={setForm} />
        <ErrorText>{error}</ErrorText>
        {progress !== null ? <Progress value={progress} /> : (
          <Button type="submit" variant="primary" icon="upload" disabled={!file} className="self-start">Upload exhibit</Button>
        )}
      </form>
    </Card>
  )
}

function Preview({ exhibit, onClose }) {
  const [lines, setLines] = useState(null)
  useEffect(() => {
    if (exhibit?.type !== 'transcript') return
    setLines(null)
    api(`/cases/exhibits/${exhibit.id}`).then(({ exhibit: e }) => setLines(e.lines ?? []))
  }, [exhibit])

  const url = exhibit && exhibitFileUrl(exhibit.id)
  return (
    <Modal open={!!exhibit} onClose={onClose} wide title={exhibit ? `${exhibit.number}: ${exhibit.title}` : ''} footer={exhibit && <a href={exhibitFileUrl(exhibit.id, { download: true })} className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-full bg-fill px-5 font-semibold text-accent hover:bg-fill-strong"><Icon name="download" size={18} /> Download</a>}>
      {exhibit?.type === 'pdf' && <PdfPreview url={url} />}
      {exhibit?.type === 'image' && <img src={url} alt={exhibit.title} className="mx-auto max-h-[65vh] rounded-xl" />}
      {exhibit?.type === 'video' && <video src={url} controls className="w-full rounded-xl bg-black" />}
      {exhibit?.type === 'transcript' && (lines ? (
        <ol className="flex max-h-[65vh] flex-col gap-1 font-mono text-sm">
          {lines.map((l) => (
            <li key={l.n} className="grid grid-cols-[3rem_1fr] gap-3">
              <span className="text-right text-muted tabular-nums">{l.n}</span>
              <span>{l.speaker && <b className="mr-1">{l.speaker}:</b>}{l.text}</span>
            </li>
          ))}
        </ol>
      ) : <Spinner />)}
    </Modal>
  )
}

export default function CaseEvidence() {
  const { kase, setCase } = useOutletContext()
  const [preview, setPreview] = useState(null)
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [replacing, setReplacing] = useState(null) // { exhibit, progress }
  const exhibits = kase.exhibits ?? []
  const [adding, setAdding] = useState(exhibits.length === 0)
  const replaceInput = useRef(null)
  const replaceTarget = useRef(null)

  async function patch(e, body, message) {
    try {
      const { case: c } = await api(`/cases/exhibits/${e.id}`, { method: 'PATCH', body })
      setCase(c)
      if (message) toast(message)
      return true
    } catch (err) {
      toast(err.message, { tone: 'error' })
      return false
    }
  }

  async function saveEdit() {
    const { number, title, party, dateAdmitted, description } = editing
    if (await patch(editing, { number, title, party, dateAdmitted, description }, `Exhibit ${number} updated.`)) setEditing(null)
  }

  async function remove() {
    try {
      const { case: c } = await api(`/cases/exhibits/${removing.id}`, { method: 'DELETE' })
      setCase(c)
      setRemoving(null)
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  async function replaceFile(ev) {
    const file = ev.target.files[0]
    const exhibit = replaceTarget.current
    ev.target.value = ''
    if (!file || !exhibit) return
    const data = new FormData()
    data.append('file', file)
    setReplacing({ exhibit, progress: 0 })
    try {
      const { case: c } = await uploadWithProgress(`/cases/exhibits/${exhibit.id}/file`, data, (progress) => setReplacing({ exhibit, progress }))
      setCase(c)
      toast(`Exhibit ${exhibit.number}’s file replaced.`)
    } catch (err) {
      toast(err.message, { tone: 'error' })
    } finally {
      setReplacing(null)
    }
  }

  const admitted = exhibits.filter((e) => e.status === 'admitted').length
  const isDemoDomain = isDemoAdminDomain()

  return (
    <div className="flex flex-col gap-6">
      {isDemoDomain && (
        <div className="rounded-xl border border-line bg-fill px-4 py-3 text-sm text-muted">
          <b>Public demo domain:</b> uploading, editing, or deleting exhibits is not allowed.
        </div>
      )}
      {kase.signoff?.valid && (
        <p className="flex items-start gap-2 rounded-xl bg-warn-soft px-4 py-3 text-warn">
          <Icon name="alert" size={20} className="mt-0.5 shrink-0" />
          The exhibit list has been signed off. Any change here (adding, editing, withdrawing or replacing an exhibit) clears the sign-off, and it must be recorded again before the case is sent to the jury iPads.
        </p>
      )}
      {adding && <UploadCard kase={kase} setCase={setCase} onClose={exhibits.length ? () => setAdding(false) : null} />}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Exhibits <span className="font-normal text-muted">({admitted} admitted{exhibits.length > admitted ? `, ${exhibits.length - admitted} withdrawn` : ''})</span></h2>
          {!adding && (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => setAdding(true)}
              disabled={isDemoDomain}
              title={isDemoDomain ? 'Public demo domain, so modification not allowed' : undefined}
            >
              Add exhibit
            </Button>
          )}
        </div>
        {replacing && <Card className="mb-3 p-4"><p className="mb-2 text-sm font-semibold">Replacing the file for {replacing.exhibit.number}…</p><Progress value={replacing.progress} /></Card>}
        {exhibits.length ? (
          <Card>
            <table className="apple-table w-full text-left">
              <thead className="border-b border-line text-sm text-muted">
                <tr><th className="py-3">No.</th><th className="py-3">Title</th><th className="py-3">Type</th><th className="py-3">Party</th><th className="py-3">Admitted</th><th className="py-3">Status</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {exhibits.map((e) => (
                  <tr key={e.id} className={cx(e.status === 'withdrawn' && 'opacity-60')}>
                    <td className="py-3 whitespace-nowrap"><Badge tone="accent">{e.number}</Badge></td>
                    <td className="py-3">
                      <button type="button" className="text-left font-semibold hover:text-accent" onClick={() => setPreview(e)}>{e.title}</button>
                      <p className="text-xs text-muted">{e.originalName} · {fmtBytes(e.size)}{e.type === 'video' && e.fps ? ` · ${e.fps} fps` : ''}{e.type === 'transcript' && e.lineCount ? ` · ${e.lineCount} lines` : ''}</p>
                    </td>
                    <td className="py-3 whitespace-nowrap text-muted"><span className="inline-flex items-center gap-1.5"><Icon name={TYPE_ICON[e.type]} size={16} />{TYPE_LABEL[e.type]}</span></td>
                    <td className="py-3 whitespace-nowrap text-muted">{PARTY_LABEL[e.party]}</td>
                    <td className="py-3 whitespace-nowrap text-muted">{fmtCalendarDate(e.dateAdmitted)}</td>
                    <td className="py-3">{e.status === 'admitted' ? <Badge tone="ok">Admitted</Badge> : <Badge>Withdrawn</Badge>}</td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <IconButton icon="eye" label={`Preview ${e.number}`} onClick={() => setPreview(e)} />
                      <IconButton
                        icon="edit"
                        label={`Edit ${e.number}`}
                        disabled={isDemoDomain}
                        title={isDemoDomain ? 'Public demo domain, so modification not allowed' : `Edit ${e.number}`}
                        onClick={() => setEditing({ ...e })}
                      />
                      <IconButton
                        icon="upload"
                        label={`Replace ${e.number}’s file`}
                        disabled={isDemoDomain || !!replacing}
                        title={isDemoDomain ? 'Public demo domain, so modification not allowed' : `Replace ${e.number}’s file`}
                        onClick={() => { replaceTarget.current = e; replaceInput.current.click() }}
                      />
                      {e.status === 'admitted'
                        ? <IconButton
                            icon="eyeOff"
                            label={`Withdraw ${e.number}`}
                            disabled={isDemoDomain}
                            title={isDemoDomain ? 'Public demo domain, so modification not allowed' : `Withdraw ${e.number}`}
                            onClick={() => patch(e, { status: 'withdrawn' }, `${e.number} withdrawn. It won’t be exported.`)}
                          />
                        : <IconButton
                            icon="refresh"
                            label={`Restore ${e.number}`}
                            disabled={isDemoDomain}
                            title={isDemoDomain ? 'Public demo domain, so modification not allowed' : `Restore ${e.number}`}
                            onClick={() => patch(e, { status: 'admitted' }, `${e.number} restored.`)}
                          />}
                      <IconButton
                        icon="trash"
                        label={`Delete ${e.number}`}
                        className="hover:text-danger"
                        disabled={isDemoDomain}
                        title={isDemoDomain ? 'Public demo domain, so modification not allowed' : `Delete ${e.number}`}
                        onClick={() => setRemoving(e)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <Card><EmptyState icon="folder" title="No exhibits yet">Upload each exhibit the court admitted into evidence.</EmptyState></Card>
        )}
        <input ref={replaceInput} type="file" accept={ACCEPT} className="hidden" onChange={replaceFile} aria-hidden tabIndex={-1} />
      </section>

      <Preview exhibit={preview} onClose={() => setPreview(null)} />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.number ?? ''}`} footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" onClick={saveEdit}>Save</Button></>}>
        {editing && <div className="flex flex-col gap-4"><MetaFields form={editing} setForm={setEditing} /></div>}
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title={`Delete ${removing?.number ?? ''}?`} footer={<><Button variant="ghost" onClick={() => setRemoving(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete</Button></>}>
        <p>Use this only for a mistake, such as the wrong file or the wrong case. If the court withdrew the exhibit, choose <b>Withdraw</b> instead so the record shows it. The deletion is recorded in the audit log.</p>
      </Modal>
    </div>
  )
}
