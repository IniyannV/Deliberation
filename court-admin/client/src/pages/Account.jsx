import { useState } from 'react'
import { api, isDemoAdminDomain } from '../lib/api'
import { useAuth } from '../store/auth'
import { toast } from '../store/ui'
import { Button, Card, ErrorText, Field, Input, PageHeader } from '../components/ui'

export default function Account() {
  const user = useAuth((s) => s.user)
  const [form, setForm] = useState({ current: '', next: '', again: '' })
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.next !== form.again) return setError('The new passwords don’t match')
    try {
      await api('/auth/password', { method: 'POST', body: { current: form.current, next: form.next } })
      setForm({ current: '', next: '', again: '' })
      toast('Password changed.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <PageHeader title="Your account" subtitle={`${user.name} · ${user.username} · ${user.role === 'admin' ? 'Admin' : 'Clerk'}`} />
      <Card className="max-w-md p-6">
        <h2 className="mb-4 text-xl font-bold">Change password</h2>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Current password">{(id) => <Input id={id} type="password" value={form.current} onChange={set('current')} autoComplete="current-password" required />}</Field>
          <Field label="New password" hint="At least 10 characters. A few unrelated words make a strong one.">{(id) => <Input id={id} type="password" value={form.next} onChange={set('next')} autoComplete="new-password" required minLength={10} />}</Field>
          <Field label="New password again">{(id) => <Input id={id} type="password" value={form.again} onChange={set('again')} autoComplete="new-password" required />}</Field>
          <ErrorText>{error}</ErrorText>
          <Button
            type="submit"
            variant="primary"
            className="self-start"
            disabled={isDemoAdminDomain()}
            title={isDemoAdminDomain() ? 'Public demo domain, so modification not allowed' : undefined}
          >
            Change password
          </Button>
        </form>
      </Card>
    </div>
  )
}
