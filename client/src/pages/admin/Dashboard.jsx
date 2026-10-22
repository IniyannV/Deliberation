import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useLive } from '../../store/live'
import { REQUEST_LABEL, STATUS_LABEL, timeAgo } from '../../lib/format'
import { toast } from '../../store/ui'
import { Badge, Button, Card, ErrorText, Field, Input, Modal, PageHeader, cx } from '../../components/ui'
import { STATUS_TONE } from '../../features/requests/RequestsPage'

export default function Dashboard() {
  const { presence, queue, exhibits, updatesVersion } = useLive()
  const [overview, setOverview] = useState(null)

  useEffect(() => { api('/admin/overview').then(setOverview).catch(() => {}) }, [queue.length, updatesVersion])

  const seats = presence.length ? presence : overview?.presence ?? []
  const open = queue.filter((r) => r.status !== 'fulfilled')

  return (
    <div>
      <PageHeader title="Bailiff dashboard" subtitle={overview ? `${overview.case.caption} · ${overview.case.caseNumber}` : ''} />

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Link to="/admin/requests" className="pressable pressable-soft rounded-2xl"><Card className="h-full p-5 hover:shadow-[var(--shadow-lift)]"><p className="font-medium text-muted">Open requests</p><p className="mt-1 text-[2.5rem] leading-none font-bold tracking-tight tabular-nums">{open.length}</p></Card></Link>
        <Link to="/admin/evidence" className="pressable pressable-soft rounded-2xl"><Card className="h-full p-5 hover:shadow-[var(--shadow-lift)]"><p className="font-medium text-muted">Exhibits loaded</p><p className="mt-1 text-[2.5rem] leading-none font-bold tracking-tight tabular-nums">{exhibits.length}</p></Card></Link>
        <Link to="/admin/updates" className="pressable pressable-soft rounded-2xl"><Card className="h-full p-5 hover:shadow-[var(--shadow-lift)]"><p className="font-medium text-muted">Unread family updates</p><p className="mt-1 text-[2.5rem] leading-none font-bold tracking-tight tabular-nums">{overview?.unreadUpdates ?? '–'}</p></Card></Link>
      </div>

      <section className="mb-8" data-tour="admin-presence">
        <h2 className="mb-3 text-xl font-bold">Juror devices</h2>
        <div className="grid grid-cols-6 gap-3 xl:grid-cols-12">
          {seats.map((s) => (
            <div key={s.seat} className={cx('flex flex-col items-center rounded-2xl border p-3', s.active ? 'border-transparent bg-surface shadow-card' : 'border-dashed border-line opacity-50')}>
              <span className="text-2xl font-bold tabular-nums">{s.seat}</span>
              <span className="flex items-center gap-1.5 text-sm text-muted">
                <span className={cx('h-2 w-2 rounded-full', s.online ? 'bg-ok' : 'bg-line')} />
                {s.active ? (s.online ? 'Online' : 'Offline') : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">Shows only whether a device is connected. Deliberation activity is not visible to court staff.</p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold">Latest requests</h2>
        <Card>
          <ul className="divide-y divide-line">
            {queue.slice(0, 6).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <span><b>Juror {r.seat}</b> · {REQUEST_LABEL[r.type]}</span>
                <span className="flex items-center gap-3 text-sm text-muted">{timeAgo(r.createdAt)} <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge></span>
              </li>
            ))}
            {!queue.length && <li className="px-5 py-6 text-muted">No requests yet.</li>}
          </ul>
        </Card>
      </section>

      <CourtControls caseNumber={overview?.case.caseNumber ?? ''} />
    </div>
  )
}

const CONTROLS = {
  signOut: {
    title: 'Sign out every juror device?',
    body: 'Every juror iPad and the room display are signed out at once and need their PIN to sign in again. Use this at the end of each court day, before the devices are collected. Nothing the jury has done is lost.',
    button: 'Sign out all',
    path: '/admin/sessions/sign-out-jurors',
    done: ({ signedOut }) => `Signed out ${signedOut} device session${signedOut === 1 ? '' : 's'}.`,
  },
  restart: {
    title: 'Restart deliberations?',
    body: 'Only when the judge instructs the jury to begin deliberations anew. This permanently clears the shared timeline, exhibit notes, transcript links and every poll and ballot, and asks the jury on the room display to begin again. Each juror’s private notes are kept.',
    button: 'Restart deliberations',
    path: '/admin/deliberation/restart',
    done: () => 'Deliberations restarted.',
  },
  erase: {
    title: 'Erase the jury’s data?',
    body: 'For the end of the trial, after the verdict, and only once the court confirms none of it must be kept. This permanently erases the shared and private timelines, notes and highlights, every vote, all chats and request messages, and the text of messages from home, then signs out every juror device. Exhibits, the case, seats, judge questions and answers, and the audit log are kept.',
    button: 'Erase permanently',
    path: '/admin/deliberation/erase',
    done: () => 'The jury’s data has been erased.',
  },
}

/** Court-day and end-of-trial actions, each behind a confirmation. */
function CourtControls({ caseNumber }) {
  const [action, setAction] = useState(null)
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const c = CONTROLS[action]
  const phrase = caseNumber || 'ERASE'

  const start = (a) => { setAction(a); setConfirm(''); setError('') }

  async function run() {
    setBusy(true)
    setError('')
    try {
      const result = await api(c.path, { method: 'POST', body: action === 'erase' ? { confirm } : {} })
      toast(c.done(result))
      setAction(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-xl font-bold">Court controls</h2>
      <Card className="divide-y divide-line">
        {[
          ['signOut', 'End of the day', 'Sign out every juror iPad and the room display so nobody can use them overnight.', 'secondary'],
          ['restart', 'Restart deliberations', 'When the judge tells the jury to begin again, for example after an alternate joins.', 'secondary'],
          ['erase', 'End of trial', 'Erase what the jury wrote and decided once the court no longer needs it.', 'danger'],
        ].map(([key, title, text, variant]) => (
          <div key={key} className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-muted">{text}</p>
            </div>
            <Button size="sm" variant={variant} onClick={() => start(key)}>{CONTROLS[key].button}</Button>
          </div>
        ))}
      </Card>
      <p className="mt-2 text-sm text-muted">Each action is recorded in the audit log.</p>

      <Modal
        open={!!c}
        onClose={() => setAction(null)}
        title={c?.title}
        footer={<>
          <Button variant="ghost" onClick={() => setAction(null)}>Cancel</Button>
          <Button variant={action === 'signOut' ? 'primary' : 'danger'} onClick={run} disabled={busy || (action === 'erase' && confirm.trim().toLowerCase() !== phrase.toLowerCase())}>{c?.button}</Button>
        </>}
      >
        {c && (
          <div className="flex flex-col gap-4">
            <p>{c.body}</p>
            {action === 'erase' && (
              <Field label={caseNumber ? `Type the case number (${caseNumber}) to confirm` : 'Type ERASE to confirm'}>
                {(id) => <Input id={id} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />}
              </Field>
            )}
            <ErrorText>{error}</ErrorText>
          </div>
        )}
      </Modal>
    </section>
  )
}
