import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { homeFor, useAuth } from '../store/auth'
import { useUi } from '../store/ui'
import { Button, Card, ErrorText, Field, Input, Spinner } from '../components/ui'
import { Icon } from '../components/icons'

export default function Login() {
  const { user, status, login } = useAuth()
  const { theme, toggleTheme } = useUi()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (status === 'loading') return <Spinner />
  if (user) return <Navigate to={homeFor(user.role)} replace />

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const u = await login(identifier.trim(), pin)
      navigate(homeFor(u.role), { replace: true })
    } catch (err) {
      setError(err.message)
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <button
        type="button"
        onClick={toggleTheme}
        className="fixed top-5 right-5 rounded-lg p-2 text-muted hover:bg-surface-2"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-semibold tracking-wide text-accent uppercase">Deliberation Room</p>
          <h1 className="mt-2 text-3xl font-bold">Sign in</h1>
          <p className="mt-2 text-muted">Use the seat number and PIN the court clerk gave you.</p>
        </div>
        <Card className="p-8">
          <form onSubmit={submit} className="flex flex-col gap-5">
            <Field label="Seat number or staff ID">
              {(id) => (
                <Input
                  id={id}
                  autoFocus
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. 4"
                  className="text-xl"
                  required
                />
              )}
            </Field>
            <Field label="PIN">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="text-xl tracking-[0.3em]"
                  required
                />
              )}
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" variant="primary" size="lg" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
        <p className="mt-6 text-center text-sm text-muted">
          This system runs only on the court&apos;s private network and never connects to the internet.
        </p>
      </div>
    </div>
  )
}
