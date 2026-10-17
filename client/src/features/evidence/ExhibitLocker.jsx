import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, exhibitFileUrl } from '../../lib/api'
import { PARTY_LABEL, TYPE_LABEL, fmtCalendarDate } from '../../lib/format'
import { useLive } from '../../store/live'
import { Icon } from '../../components/icons'
import { Badge, EmptyState, ErrorText, Input, PageHeader, Segmented, Select } from '../../components/ui'

const TYPE_ICON = { pdf: 'file', image: 'image', transcript: 'text', map: 'map', chart: 'chart' }
const THUMB_TEXT = { pdf: 'PDF document', map: 'Interactive map', chart: 'Interactive chart' }

export function ExhibitThumb({ exhibit, className = 'h-36' }) {
  if (exhibit.type === 'image') {
    return <img src={exhibitFileUrl(exhibit.id)} alt="" loading="lazy" className={`${className} w-full rounded-t-xl object-cover`} />
  }
  return (
    <div className={`${className} flex w-full flex-col items-center justify-center gap-2 rounded-t-xl bg-surface-2 text-muted`}>
      <Icon name={TYPE_ICON[exhibit.type]} size={40} strokeWidth={1.4} />
      <span className="text-sm">{exhibit.type === 'transcript' ? `${exhibit.lineCount} lines` : THUMB_TEXT[exhibit.type]}</span>
    </div>
  )
}

function Highlight({ text, q }) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return text
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return text.split(re).map((p, i) => (i % 2 ? <mark key={i} className="rounded bg-warn-soft px-0.5 text-ink">{p}</mark> : p))
}

export default function ExhibitLocker() {
  const version = useLive((s) => s.exhibits)
  const notes = useLive((s) => s.notes)
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [party, setParty] = useState('')
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  // Server-side search so full-text search scales to a real case file.
  useEffect(() => {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (type) params.set('type', type)
    if (party) params.set('party', party)
    const t = setTimeout(() => {
      api(`/exhibits?${params}`)
        .then(({ exhibits }) => { setResults(exhibits); setError('') })
        .catch((e) => setError(e.message))
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q, type, party, version])

  return (
    <div>
      <PageHeader title="Exhibit locker" subtitle="Every exhibit admitted into evidence, including interactive maps and charts. Search covers titles, descriptions, transcripts and the labels inside maps and charts." />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="relative min-w-72 flex-1" data-tour="locker-search">
          <span className="sr-only">Search exhibits</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exhibits and transcripts…" className="pl-10" />
        </label>
        <Segmented
          label="Exhibit type"
          value={type}
          onChange={setType}
          options={[{ value: '', label: 'All' }, { value: 'pdf', label: 'Documents' }, { value: 'image', label: 'Images' }, { value: 'transcript', label: 'Transcripts' }, { value: 'map', label: 'Maps' }, { value: 'chart', label: 'Charts' }]}
        />
        <Select value={party} onChange={(e) => setParty(e.target.value)} className="w-auto" aria-label="Introduced by">
          <option value="">Introduced by: anyone</option>
          {Object.entries(PARTY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>

      <ErrorText>{error}</ErrorText>

      {results && !results.length && (
        <EmptyState icon="search" title="No exhibits match">Try fewer words, or clear the filters.</EmptyState>
      )}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-5" data-tour="locker-grid">
        {results?.map((e) => (
          <li key={e.id}>
            <Link to={`/juror/evidence/${e.id}`} className="pressable pressable-soft flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface hover:border-accent hover:shadow-[0_6px_24px_-12px_rgb(0_0_0/0.25)]">
              <ExhibitThumb exhibit={e} />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="accent">{e.number}</Badge>
                  <span className="text-sm text-muted">{PARTY_LABEL[e.party]}</span>
                </div>
                <h2 className="leading-snug font-bold"><Highlight text={e.title} q={q} /></h2>
                <p className="text-sm text-muted">{TYPE_LABEL[e.type]} · Admitted {fmtCalendarDate(e.dateAdmitted)}</p>
                {notes.some((n) => n.exhibitId === e.id) && (
                  <p className="flex items-center gap-1 text-sm text-accent"><Icon name="note" size={14} /> {notes.filter((n) => n.exhibitId === e.id).length} jury note{notes.filter((n) => n.exhibitId === e.id).length === 1 ? '' : 's'}</p>
                )}
                {e.hits?.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-1 border-t border-line pt-2 text-sm">
                    {e.hits.map((h) => (
                      <li key={h.n} className="line-clamp-2">
                        <span className="font-mono text-muted">L{h.n} </span>
                        {h.speaker && <b>{h.speaker}: </b>}
                        <Highlight text={h.text} q={q} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
