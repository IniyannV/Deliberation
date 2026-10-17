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
        className="pressable fixed top-5 right-5 rounded-lg p-2 text-muted hover:bg-surface-2"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-[0.08em] text-accent uppercase">Deliberation Room</p>
          <h1 className="mt-2 text-4xl font-bold">Sign in</h1>
          <p className="mt-2 text-muted">Use the seat number and PIN the court clerk gave you.</p>
        </div>
        <Card className="p-8 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_40px_-16px_rgb(0_0_0/0.18)]">
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
        <details className="mt-6 rounded-xl border border-line bg-surface px-5 py-3 text-sm">
          <summary className="cursor-pointer font-semibold">Trying out the demo?</summary>
          <ul className="mt-2 flex flex-col gap-1 text-muted">
            <li><b className="text-ink">1</b>: foreperson (juror with polls, ballots and display controls)</li>
            <li><b className="text-ink">2–12</b>: jurors</li>
            <li><b className="text-ink">B1</b>: bailiff / clerk</li>
            <li><b className="text-ink">DISPLAY</b>: room projector</li>
          </ul>
          <p className="mt-2 text-muted">PINs are printed by <code>npm run seed</code> and saved in <code>server/data/demo-credentials.txt</code>. After signing in, choose <b className="text-ink">Guided tour</b> in the sidebar.</p>
        </details>
      </div>
    </div>
  )
}
