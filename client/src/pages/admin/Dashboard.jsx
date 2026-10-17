import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useLive } from '../../store/live'
import { REQUEST_LABEL, STATUS_LABEL, timeAgo } from '../../lib/format'
import { Badge, Card, PageHeader, cx } from '../../components/ui'
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

      <section>
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
    </div>
  )
}
