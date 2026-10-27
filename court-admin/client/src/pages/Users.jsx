import { useEffect, useState } from 'react'
import { api, isDemoAdminDomain } from '../lib/api'
import { useAuth } from '../store/auth'
import { toast } from '../store/ui'
import { Badge, Button, Card, ErrorText, Field, Input, Modal, PageHeader, Select, cx } from '../components/ui'

/** Court office accounts. Admins only; the server enforces it too. */
export default function Users() {
  const me = useAuth((s) => s.user)
  const [users, setUsers] = useState([])
  const [adding, setAdding] = useState(false)
  const [secret, setSecret] = useState(null) // { username, password }: shown once
  const [confirm, setConfirm] = useState(null) // { user, action }

  const load = () => api('/users').then(({ users }) => setUsers(users))
  useEffect(() => { load() }, [])

  async function run() {
    const { user, action } = confirm
    setConfirm(null)
    try {
      if (action === 'reset') {
        const { password } = await api(`/users/${user.id}/reset-password`, { method: 'POST' })
        setSecret({ username: user.username, password })
      }
      if (action === 'deactivate') await api(`/users/${user.id}`, { method: 'PATCH', body: { active: false } })
      if (action === 'activate') await api(`/users/${user.id}`, { method: 'PATCH', body: { active: true } })
      if (action === 'role') await api(`/users/${user.id}`, { method: 'PATCH', body: { role: user.role === 'admin' ? 'clerk' : 'admin' } })
      load()
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  const MESSAGES = {
    reset: (u) => `${u.name} gets a new password and is signed out everywhere.`,
    deactivate: (u) => `${u.name} is signed out and can’t sign in until reactivated. Their past actions stay in the audit log.`,
    activate: (u) => `${u.name} will be able to sign in again.`,
    role: (u) => (u.role === 'admin' ? `${u.name} becomes a clerk and can no longer manage accounts.` : `${u.name} becomes an admin and can manage accounts.`),
  }

  const isDemoDomain = isDemoAdminDomain()

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Everyone who can sign in to Court Admin. Clerks prepare and export cases; admins can also manage accounts. Each person’s actions are recorded under their name."
        actions={
          <Button
            variant="primary"
            icon="plus"
            onClick={() => setAdding(true)}
            disabled={isDemoDomain}
            title={isDemoDomain ? 'Public demo domain, so modification not allowed' : undefined}
          >
            Add account
          </Button>
        }
      />
      <Card>
        <table className="apple-table w-full text-left">
          <thead className="border-b border-line text-sm text-muted">
            <tr><th className="px-5 py-3">Name</th><th className="py-3">Username</th><th className="py-3">Role</th><th className="py-3">Status</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => {
              const self = u.id === me.id
              return (
                <tr key={u.id} className={cx(!u.active && 'opacity-60')}>
                  <td className="px-5 py-3 font-semibold">{u.name}{self && <span className="ml-2 text-sm font-normal text-muted">(you)</span>}</td>
                  <td className="py-3 font-mono text-sm">{u.username}</td>
                  <td className="py-3">{u.role === 'admin' ? <Badge tone="accent">Admin</Badge> : <Badge>Clerk</Badge>}</td>
                  <td className="py-3">{u.active ? <Badge tone="ok">Active</Badge> : <Badge>Deactivated</Badge>}</td>
                  <td className="py-3 pr-4 text-right whitespace-nowrap">
                    {!self && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirm({ user: u, action: 'role' })}
                        disabled={isDemoDomain}
                        title={isDemoDomain ? 'Public demo domain, so modification not allowed' : undefined}
                      >
                        {u.role === 'admin' ? 'Make clerk' : 'Make admin'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirm({ user: u, action: 'reset' })}
                      disabled={isDemoDomain}
                      title={isDemoDomain ? 'Public demo domain, so modification not allowed' : undefined}
                    >
                      Reset password
                    </Button>
                    {!self && (u.active
                      ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirm({ user: u, action: 'deactivate' })}
                          disabled={isDemoDomain}
                          title={isDemoDomain ? 'Public demo domain, so modification not allowed' : undefined}
                        >
                          Deactivate
                        </Button>
                      )
                      : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirm({ user: u, action: 'activate' })}
                          disabled={isDemoDomain}
                          title={isDemoDomain ? 'Public demo domain, so modification not allowed' : undefined}
                        >
                          Reactivate
                        </Button>
                      ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      <AddAccount open={adding} onClose={() => setAdding(false)} onAdded={(username, password) => { setAdding(false); setSecret({ username, password }); load() }} />

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Please confirm" footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="primary" onClick={run}>Confirm</Button></>}>
        {confirm && <p>{MESSAGES[confirm.action](confirm.user)}</p>}
      </Modal>

      <Modal open={!!secret} onClose={() => setSecret(null)} title={`Password for ${secret?.username ?? ''}`} footer={<Button variant="primary" onClick={() => setSecret(null)}>Done</Button>}>
        <p className="mb-4 text-muted">Give this to the person privately. It won’t be shown again. They can change it under their name in the sidebar.</p>
        <p className="rounded-2xl bg-fill py-5 text-center font-mono text-2xl select-all">{secret?.password}</p>
      </Modal>
    </div>
  )
}

function AddAccount({ open, onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', username: '', role: 'clerk' })
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      const { user, password } = await api('/users', { method: 'POST', body: form })
      setForm({ name: '', username: '', role: 'clerk' })
      onAdded(user.username, password)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add account" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="add-account">Add account</Button></>}>
      <form id="add-account" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Full name">{(id) => <Input id={id} value={form.name} onChange={set('name')} required maxLength={80} autoFocus />}</Field>
        <Field label="Username" hint="Letters, numbers, dots, dashes and underscores.">{(id) => <Input id={id} value={form.username} onChange={set('username')} required maxLength={32} autoComplete="off" />}</Field>
        <Field label="Role">
          {(id) => <Select id={id} value={form.role} onChange={set('role')}><option value="clerk">Clerk: prepares and exports cases</option><option value="admin">Admin: also manages accounts</option></Select>}
        </Field>
        <ErrorText>{error}</ErrorText>
        <p className="text-sm text-muted">A password is generated and shown once.</p>
      </form>
    </Modal>
  )
}
