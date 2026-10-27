import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { Card, EmptyState, Spinner, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import { CaseStatus } from '../Cases'

const TABS = [
  { to: '', label: 'Details', icon: 'info', end: true },
  { to: 'charges', label: 'Charges', icon: 'list' },
  { to: 'evidence', label: 'Evidence', icon: 'folder' },
  { to: 'jury', label: 'Jury & PINs', icon: 'key' },
  { to: 'export', label: 'Sign-off & send', icon: 'send' },
]

/**
 * One case's workspace. Loads the case and hands it to each tab through the
 * outlet context: `{ kase, setCase }`. Every API call that changes a case
 * returns the updated case, so tabs just pass it to setCase.
 */
export default function CaseLayout() {
  const { id } = useParams()
  const [kase, setKase] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setKase(null)
    api(`/cases/${id}`).then(({ case: c }) => setKase(c)).catch((err) => setError(err.message))
  }, [id])

  const setCase = useCallback((c) => setKase(c), [])

  if (error) return <EmptyState icon="alert" title="Case not found">{error} <Link to="/cases" className="text-accent">Back to cases</Link></EmptyState>
  if (!kase) return <Spinner />

  const failing = (kase.readiness?.checks ?? []).filter((c) => !c.ok).length
  return (
    <div>
      <Link to="/cases" className="mb-3 inline-flex items-center gap-1 text-accent hover:underline print:hidden"><Icon name="chevronLeft" size={16} /> Cases</Link>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="text-sm font-semibold text-muted tabular-nums"><span className="font-mono text-accent mr-2">{kase.id}</span>{kase.caseNumber}{kase.court && ` · ${kase.court}`}</p>
          <h1 className="text-[2.125rem] font-bold">{kase.caption}</h1>
        </div>
        <CaseStatus c={kase} />
      </header>
      <Card className="mb-6 flex gap-1 overflow-x-auto p-1.5 print:hidden">
        {TABS.map((t) => (
          <NavLink
            key={t.label}
            to={t.to}
            end={t.end}
            className={({ isActive }) => cx('flex items-center gap-2 rounded-xl px-4 py-2 font-medium whitespace-nowrap', isActive ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-fill')}
          >
            <Icon name={t.icon} size={17} />
            {t.label}
            {t.to === 'export' && failing > 0 && <span className="rounded-full bg-warn-soft px-2 text-xs font-semibold text-warn tabular-nums">{failing} to do</span>}
          </NavLink>
        ))}
      </Card>
      <Outlet context={{ kase, setCase }} />
    </div>
  )
}
