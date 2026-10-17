import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { homeFor, useAuth } from '../store/auth'
import { useUi } from '../store/ui'
import { Button, ErrorText, IconButton, Spinner, cx } from '../components/ui'
import { Icon } from '../components/icons'

export default function Login() {
  const { user, status, login } = useAuth()
  const { theme, toggleTheme } = useUi()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)

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
      setShake((n) => n + 1) // the macOS "wrong password" shake
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full bg-transparent px-4 py-3.5 text-[1.0625rem] text-ink placeholder:text-muted focus:outline-none'

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10">
      <IconButton
        icon={theme === 'dark' ? 'sun' : 'moon'}
        label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="fixed top-4 right-4"
        onClick={toggleTheme}
      />
      <div className="materialize w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.1rem] bg-linear-to-b from-[#3b8cff] to-[#0062d6] text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.4),0_8px_24px_-6px_rgb(0_113_227/0.5)]">
            <Icon name="scale" size={38} strokeWidth={1.6} />
          </span>
          <h1 className="text-[2rem] font-bold">Deliberation</h1>
          <p className="mt-2 text-[1.0625rem] text-muted">Sign in with the seat number and PIN the court clerk gave you.</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {/* Grouped inset fields, separated by a hairline. */}
          <div key={shake} className={cx('overflow-hidden rounded-2xl bg-surface shadow-card focus-within:shadow-[0_0_0_4px_var(--color-accent-soft),var(--shadow-card)]', shake && 'shake')}>
            <label className="sr-only" htmlFor="login-id">Seat number or staff ID</label>
            <input
              id="login-id"
              autoFocus
              autoComplete="username"
              autoCapitalize="characters"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Seat number or staff ID"
              className={field}
              required
            />
            <div className="ml-4 h-px bg-line" />
            <label className="sr-only" htmlFor="login-pin">PIN</label>
            <input
              id="login-pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN"
              className={cx(field, pin && 'tracking-[0.3em]')}
              required
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" variant="primary" size="lg" disabled={busy} className="w-full">
            {busy ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <p className="mt-6 flex items-start justify-center gap-1.5 text-center text-sm text-muted">
          <Icon name="shield" size={16} className="mt-0.5 shrink-0" />
          This system runs only on the court&apos;s private network and never connects to the internet.
        </p>

        <details className="group mt-6 rounded-2xl bg-surface text-sm shadow-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
            Trying out the demo?
            <Icon name="chevronRight" size={16} className="text-muted transition-transform duration-200 group-open:rotate-90" />
          </summary>
          <div className="px-4 pb-4">
            <ul className="flex flex-col gap-1 text-muted">
              <li><b className="text-ink">1</b>: foreperson (juror with polls, ballots and display controls)</li>
              <li><b className="text-ink">2–12</b>: jurors</li>
              <li><b className="text-ink">B1</b>: bailiff / clerk</li>
              <li><b className="text-ink">DISPLAY</b>: room projector</li>
            </ul>
            <p className="mt-2 text-muted">PINs are printed by <code>npm run seed</code> and saved in <code>server/data/demo-credentials.txt</code>. After signing in, choose <b className="text-ink">Guided tour</b> in the sidebar.</p>
          </div>
        </details>
      </div>
    </div>
  )
}
