import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useLive } from '../../store/live'
import { Badge, Card, ErrorText, PageHeader, Select } from '../../components/ui'
import { Icon } from '../../components/icons'

const FILTERS = [
  ['', 'All activity'],
  ['auth', 'Sign-ins'],
  ['request', 'Requests'],
  ['update', 'Family updates'],
  ['exhibit', 'Evidence'],
  ['seat', 'Seat changes'],
]

const fmtTs = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })

export default function Audit() {
  const queue = useLive((s) => s.queue)
  const [filter, setFilter] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api(`/admin/audit?limit=500${filter ? `&action=${filter}` : ''}`).then(setData).catch((e) => setError(e.message))
  }, [filter, queue])

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Append-only record of sign-ins, requests, status changes, family updates and evidence uploads. Deliberation content (timeline, votes, notes) is never logged."
        actions={
          <a href="/api/admin/audit.csv" download className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 font-semibold hover:bg-surface-2">
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
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr><th className="px-4 py-3">#</th><th className="py-3 pr-4">Time</th><th className="py-3 pr-4">Actor</th><th className="py-3 pr-4">Action</th><th className="py-3 pr-4">Details</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data?.entries.map((e) => (
              <tr key={e.seq}>
                <td className="px-4 py-2 text-muted tabular-nums">{e.seq}</td>
                <td className="py-2 pr-4 whitespace-nowrap tabular-nums" title={e.ts}>{fmtTs(e.ts)}</td>
                <td className="py-2 pr-4">{e.actor} <span className="text-muted">({e.role})</span></td>
                <td className="py-2 pr-4 font-mono">{e.action}</td>
                <td className="py-2 pr-4 text-muted">{Object.entries(e.meta).map(([k, v]) => `${k}: ${v}`).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {data && <p className="mt-3 text-sm text-muted">Showing the latest {data.entries.length} of {data.total}. The CSV export includes every entry with its hash chain.</p>}
    </div>
  )
}
