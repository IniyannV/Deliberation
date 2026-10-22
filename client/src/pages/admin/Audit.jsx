import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useLive } from '../../store/live'
import { Badge, Card, ErrorText, PageHeader, Select } from '../../components/ui'
import { Icon } from '../../components/icons'

const FILTERS = [
  ['', 'All activity'],
  ['auth', 'Sign-ins'],
  ['request', 'Requests'],
  ['exhibit', 'Evidence'],
  ['seat', 'Seat changes'],
]

const CATEGORY = {
  auth: { label: 'Sign-in', icon: 'logout', tone: 'neutral' },
  request: { label: 'Request', icon: 'bell', tone: 'warn' },
  update: { label: 'Family update', icon: 'mail', tone: 'accent' }, // retired feature; older entries only
  exhibit: { label: 'Evidence', icon: 'folder', tone: 'accent' },
  seat: { label: 'Seat', icon: 'users', tone: 'neutral' },
  catalog: { label: 'Menu', icon: 'utensils', tone: 'neutral' },
  audit: { label: 'Audit', icon: 'shield', tone: 'neutral' },
  seed: { label: 'System', icon: 'refresh', tone: 'neutral' },
}

const fmtDay = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
const fmtClock = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })

export default function Audit() {
  const queue = useLive((s) => s.queue)
  const [filter, setFilter] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api(`/admin/audit?limit=500${filter ? `&action=${filter}` : ''}`).then(setData).catch((e) => setError(e.message))
  }, [filter, queue])

  // Group entries under a heading per day.
  const groups = []
  for (const e of data?.entries ?? []) {
    const day = fmtDay(e.ts)
    if (groups.at(-1)?.day !== day) groups.push({ day, entries: [] })
    groups.at(-1).entries.push(e)
  }

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Append-only record of sign-ins, requests, status changes and evidence uploads. Deliberation content (timeline, votes, notes, message text) is never logged."
        actions={
          <a href="/api/admin/audit.csv" download className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-full bg-fill px-5 py-1.5 font-semibold text-accent hover:bg-fill-strong">
            <Icon name="download" /> Export CSV
          </a>
        }
      />
      <ErrorText>{error}</ErrorText>
      {data && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-auto" aria-label="Filter">
            {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          {data.chain.ok
            ? <Badge tone="ok"><Icon name="shield" size={14} /> Integrity check passed · {data.chain.count} entries</Badge>
            : <Badge tone="danger"><Icon name="shield" size={14} /> Log altered at entry #{data.chain.brokenAt}</Badge>}
        </div>
      )}

      <div className="flex flex-col gap-6" data-tour="audit-list">
        {groups.map((g) => (
          <section key={g.day}>
            <h2 className="mb-2 text-[0.8125rem] font-semibold text-muted">{g.day}</h2>
            <Card>
              <ul className="divide-y divide-line">
                {g.entries.map((e) => {
                  const cat = CATEGORY[e.action.split('.')[0]] ?? CATEGORY.audit
                  const failed = e.action === 'auth.login_failed'
                  return (
                    <li key={e.seq} className="flex items-start gap-4 px-5 py-3">
                      <span className="w-24 shrink-0 pt-0.5 text-sm text-muted tabular-nums" title={e.ts}>{fmtClock(e.ts)}</span>
                      <span className={`mt-0.5 shrink-0 rounded-[0.5rem] p-1.5 ${failed ? 'bg-danger-soft text-danger' : 'bg-fill text-muted'}`}><Icon name={cat.icon} size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <p className={failed ? 'font-semibold text-danger' : 'font-semibold'}>{e.summary}</p>
                        <p className="text-xs text-muted">
                          {cat.label} · by {e.actorName} · entry #{e.seq} · <span className="font-mono">{e.action}</span>
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          </section>
        ))}
      </div>
      {data && <p className="mt-3 text-sm text-muted">Showing the latest {data.entries.length} of {data.total}. The CSV export includes every entry, its plain-English summary and its hash chain.</p>}
    </div>
  )
}
