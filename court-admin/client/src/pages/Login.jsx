import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { Button, Card, ErrorText, Field, Input } from '../components/ui'
import { Icon } from '../components/icons'

export default function Login() {
  const login = useAuth((s) => s.login)
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(username, password)
      navigate('/cases')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-b from-[#3b8cff] to-[#0062d6] text-white"><Icon name="scale" size={30} /></span>
          <h1 className="text-2xl font-bold">Court Admin</h1>
          <p className="text-muted">Sign in with your court office account.</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Username">{(id) => <Input id={id} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />}</Field>
          <Field label="Password">{(id) => <Input id={id} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />}</Field>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          <a className="font-semibold text-accent underline" href="https://github.com/IniyannV/Deliberation#demo-credentials--passwords" target="_blank" rel="noreferrer">View demo usernames and passwords in the README</a>
        </p>
        <p className="mt-2 text-center text-sm text-muted">No account? Ask a Court Admin administrator.</p>
      </Card>
    </div>
  )
}
