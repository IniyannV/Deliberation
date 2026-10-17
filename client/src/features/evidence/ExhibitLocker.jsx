import { Suspense, lazy, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, exhibitFileUrl } from '../../lib/api'
import { PARTY_LABEL, TYPE_LABEL, fmtCalendarDate } from '../../lib/format'
import { useLive } from '../../store/live'
import { Icon } from '../../components/icons'
import { Badge, EmptyState, ErrorText, Input, PageHeader, Segmented, Select } from '../../components/ui'

const PdfThumb = lazy(() => import('./PdfThumb'))

const TYPE_ICON = { pdf: 'file', image: 'image', transcript: 'text', video: 'video', youtube: 'video' }

function Placeholder({ exhibit, className }) {
  return (
    <div className={`${className} flex w-full flex-col items-center justify-center gap-2 bg-surface-2 text-muted`}>
      <Icon name={TYPE_ICON[exhibit.type]} size={40} strokeWidth={1.4} />
      <span className="text-sm">{TYPE_LABEL[exhibit.type]}</span>
    </div>
  )
}

// A sheet of paper peeking up from the bottom of the thumbnail.
const PAPER = 'mx-auto mt-4 w-[78%] overflow-hidden rounded-t-[3px] bg-white shadow-[0_1px_3px_rgb(0_0_0/0.18),0_6px_16px_rgb(0_0_0/0.1)]'

/** A static preview of any exhibit: the image, a PDF's first page, a video frame, or a transcript's opening lines. */
export function ExhibitThumb({ exhibit, className = 'h-36' }) {
  const url = exhibitFileUrl(exhibit.id)
  if (exhibit.type === 'image') {
    return <img src={url} alt="" loading="lazy" className={`${className} w-full object-cover`} />
  }
  if (exhibit.type === 'video') {
    return (
      <div className={`${className} relative w-full overflow-hidden bg-black`}>
        {/* #t= asks for a frame from just after the start, which iPad Safari will paint without playing. */}
        <video src={`${url}#t=0.5`} preload="metadata" muted playsInline disablePictureInPicture tabIndex={-1} aria-hidden className="pointer-events-none h-full w-full object-cover" />
        <span className="material absolute top-1/2 left-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-ink" aria-hidden>
          <Icon name="play" size={20} strokeWidth={0} className="ml-0.5 fill-current" />
        </span>
      </div>
    )
  }
  if (exhibit.type === 'pdf') {
    const fallback = <Placeholder exhibit={exhibit} className="h-full" />
    return (
      <div className={`${className} w-full overflow-hidden bg-surface-2`} aria-hidden>
        <div className={`${PAPER} [&_canvas]:!h-auto [&_canvas]:!w-full`}>
          <Suspense fallback={fallback}><PdfThumb url={url} width={320} fallback={fallback} /></Suspense>
        </div>
      </div>
    )
  }
  if (exhibit.type === 'transcript' && exhibit.preview?.length) {
    return (
      <div className={`${className} w-full overflow-hidden bg-surface-2`} aria-hidden>
        <div className={`${PAPER} px-3.5 pt-3 pb-6 font-mono text-[0.5625rem] leading-[1.6] text-black/75`}>
          {exhibit.preview.map((l) => (
            <p key={l.n} className="truncate">
              <span className="mr-1.5 text-black/35 tabular-nums">{l.n}</span>
              {l.speaker && <b className="text-black">{l.speaker}: </b>}
              {l.text}
            </p>
          ))}
        </div>
      </div>
    )
  }
  return <Placeholder exhibit={exhibit} className={className} />
}

function Highlight({ text, q }) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return text
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return text.split(re).map((p, i) => (i % 2 ? <mark key={i} className="rounded-sm bg-[#ffd60a]/50 px-0.5 text-ink">{p}</mark> : p))
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
      <PageHeader title="Exhibit locker" subtitle="Every exhibit admitted into evidence. Search covers titles, descriptions and every line of every transcript." />

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
          options={[{ value: '', label: 'All' }, { value: 'pdf', label: 'Documents' }, { value: 'image', label: 'Images' }, { value: 'transcript', label: 'Transcripts' }, { value: 'video', label: 'Video' }, { value: 'youtube', label: 'YouTube' }]}
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
            <Link to={`/juror/evidence/${e.id}`} className="pressable pressable-soft flex h-full flex-col overflow-hidden rounded-2xl bg-surface shadow-card hover:shadow-[var(--shadow-lift)]">
              <ExhibitThumb exhibit={e} />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="accent">{e.number}</Badge>
                  <span className="text-sm text-muted">{PARTY_LABEL[e.party]}</span>
                </div>
                <h2 className="text-[1.0625rem] leading-snug font-semibold"><Highlight text={e.title} q={q} /></h2>
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
