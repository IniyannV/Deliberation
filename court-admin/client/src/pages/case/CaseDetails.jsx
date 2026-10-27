import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { api, isDemoAdminDomain } from '../../lib/api'
import { useAuth } from '../../store/auth'
import { toast } from '../../store/ui'
import { fmtDateTime } from '../../lib/format'
import { Button, Card, ErrorText, Field, Input, Modal, Textarea } from '../../components/ui'

export default function CaseDetails() {
  const { kase, setCase } = useOutletContext()
  const isAdmin = useAuth((s) => s.user.role === 'admin')
  const navigate = useNavigate()
  const [form, setForm] = useState({ caption: kase.caption, caseNumber: kase.caseNumber, court: kase.court, burden: kase.burden })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const dirty = Object.keys(form).some((k) => form[k] !== kase[k])

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { case: c } = await api(`/cases/${kase.id}`, { method: 'PATCH', body: form })
      setCase(c)
      toast('Case details saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(status) {
    try {
      const { case: c } = await api(`/cases/${kase.id}`, { method: 'PATCH', body: { status } })
      setCase(c)
      toast(status === 'archived' ? 'Case archived. It can’t be exported until reopened.' : 'Case reopened.')
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  async function remove() {
    try {
      await api(`/cases/${kase.id}`, { method: 'DELETE' })
      toast(`Case ${kase.caseNumber} deleted.`)
      navigate('/cases')
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <Card className="p-6">
        <form onSubmit={save} className="flex flex-col gap-4">
          <Field label="Caption">{(id) => <Input id={id} value={form.caption} onChange={set('caption')} required maxLength={160} />}</Field>
          <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
            <Field label="Case number">{(id) => <Input id={id} value={form.caseNumber} onChange={set('caseNumber')} required maxLength={40} />}</Field>
            <Field label="Court">{(id) => <Input id={id} value={form.court} onChange={set('court')} maxLength={160} />}</Field>
          </div>
          <Field label="Burden of proof" hint="Shown to jurors beside every ballot. Copy it from the judge’s written instructions.">
            {(id) => <Textarea id={id} value={form.burden} onChange={set('burden')} maxLength={4000} className="min-h-32" />}
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="primary"
              disabled={isDemoAdminDomain() || busy || !dirty}
              title={isDemoAdminDomain() ? 'Public demo domain, so modification not allowed' : undefined}
            >
              Save details
            </Button>
            {dirty && <span className="text-sm text-warn">Unsaved changes</span>}
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="p-5 text-sm">
          <p className="text-muted">Created</p>
          <p className="mb-3 font-medium">{fmtDateTime(kase.createdAt)}</p>
          <p className="text-muted">Last changed</p>
          <p className="font-medium">{fmtDateTime(kase.updatedAt)}</p>
        </Card>
        <Card className="flex flex-col gap-3 p-5">
          {kase.status === 'archived' ? (
            <>
              <p className="text-sm text-muted">This case is archived. Reopen it to make changes count toward an export.</p>
              <Button
                icon="refresh"
                onClick={() => setStatus('active')}
                disabled={isDemoAdminDomain()}
                title={isDemoAdminDomain() ? 'Public demo domain, so modification not allowed' : undefined}
              >
                Reopen case
              </Button>
              {isAdmin && (
                <Button
                  variant="danger"
                  icon="trash"
                  onClick={() => setDeleting(true)}
                  disabled={isDemoAdminDomain()}
                  title={isDemoAdminDomain() ? 'Public demo domain, so modification not allowed' : undefined}
                >
                  Delete case
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted">Archive a case once the trial is over. Archived cases can’t be exported.</p>
              <Button
                icon="archive"
                onClick={() => setStatus('archived')}
                disabled={isDemoAdminDomain()}
                title={isDemoAdminDomain() ? 'Public demo domain, so modification not allowed' : undefined}
              >
                Archive case
              </Button>
            </>
          )}
        </Card>
      </div>

      <Modal open={deleting} onClose={() => setDeleting(false)} title={`Delete ${kase.caseNumber}?`} footer={<><Button variant="ghost" onClick={() => setDeleting(false)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete permanently</Button></>}>
        <p>This permanently deletes the case, its {(kase.exhibits ?? []).length} exhibit{(kase.exhibits ?? []).length === 1 ? '' : 's'} and their files from this server. Packages already exported are not affected. The deletion is recorded in the audit log.</p>
      </Modal>
    </div>
  )
}
