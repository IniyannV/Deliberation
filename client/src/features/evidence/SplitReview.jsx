import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { load, store } from '../../lib/storage'
import { Button, Card, EmptyState, Field, Input, Modal, Select, Spinner } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useExhibit } from './useExhibit'
import ExhibitViewer from './ExhibitViewer'
import TranscriptView from './TranscriptView'

function ExhibitPicker({ value, onChange, exhibits, label }) {
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label={label} className="min-w-0 flex-1 py-1.5">
      <option value="">{label}…</option>
      {exhibits.map((e) => <option key={e.id} value={e.id}>{e.number}: {e.title}</option>)}
    </Select>
  )
}

export default function SplitReview() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const exhibits = useLive((s) => s.exhibits)
  const links = useLive((s) => s.links)
  const emit = useLive((s) => s.emit)
  const exhibitsById = useMemo(() => Object.fromEntries(exhibits.map((e) => [e.id, e])), [exhibits])
  const transcripts = exhibits.filter((e) => e.type === 'transcript')

  const transcriptId = params.get('t') ?? transcripts[0]?.id ?? null
  const rightId = params.get('ex')
  const rightLine = Number(params.get('rline')) || undefined
  const { exhibit: transcript } = useExhibit(transcriptId)

  const [query, setQuery] = useState('')
  const [selection, setSelection] = useState(null)
  const [linkLine, setLinkLine] = useState(null)
  const [linkTarget, setLinkTarget] = useState('')
  const [split, setSplit] = useState(() => load('splitPct', 50))
  const container = useRef(null)

  const setParam = (k, v) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v); else next.delete(k)
    if (k === 'ex') next.delete('rline')
    setParams(next, { replace: true })
  }

  useEffect(() => setSelection(null), [transcriptId])

  // Draggable divider between the panes.
  const startDrag = useCallback((e) => {
    e.preventDefault()
    const box = container.current.getBoundingClientRect()
    const move = (ev) => setSplit(Math.min(75, Math.max(25, ((ev.clientX - box.left) / box.width) * 100)))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setSplit((s) => { store('splitPct', s); return s })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [])

  const onSelect = (n, shift) => {
    if (shift && selection) setSelection({ from: Math.min(selection.from, n), to: Math.max(selection.to, n) })
    else if (selection && selection.from === n && selection.to === n) setSelection(null)
    else setSelection({ from: n, to: n })
  }

  async function createLink() {
    try {
      await emit('link:create', { transcriptId, line: linkLine, exhibitId: linkTarget })
      setLinkLine(null)
      setParam('ex', linkTarget)
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  const unlink = async (id) => {
    try { await emit('link:delete', { id }) } catch (err) { toast(err.message, { tone: 'error' }) }
  }

  if (!transcripts.length) return <EmptyState icon="text" title="No transcripts yet">Transcripts appear here once the clerk loads them.</EmptyState>

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Side-by-side review</h1>
        <p className="text-muted">Click a line number to select it (Shift-click for a range). Use <Icon name="link" size={16} className="inline" /> to link a line to an exhibit.</p>
      </div>

      <div ref={container} className="flex min-h-0 flex-1">
        {/* Left: transcript */}
        <Card className="flex min-h-0 min-w-0 flex-col overflow-hidden" style={{ width: `${split}%` }} data-tour="review-transcript">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <ExhibitPicker value={transcriptId} onChange={(v) => setParam('t', v)} exhibits={transcripts} label="Choose a transcript" />
            <label className="relative w-44">
              <span className="sr-only">Find in transcript</span>
              <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
              <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find…" className="py-1.5 pl-8" />
            </label>
          </div>
          {selection && (
            <div className="flex items-center justify-between gap-2 border-b border-line bg-accent-soft px-3 py-2 text-sm">
              <span className="font-semibold text-accent">
                Lines {selection.from}{selection.to !== selection.from ? `–${selection.to}` : ''} selected
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  icon="timeline"
                  onClick={() => navigate('/juror/timeline', {
                    state: { draft: { type: 'testimony', attachments: [{ kind: 'excerpt', transcriptId, fromLine: selection.from, toLine: selection.to }] } },
                  })}
                >
                  Add to timeline
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelection(null)}>Clear</Button>
              </div>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin">
            {transcript ? (
              <TranscriptView
                exhibit={transcript}
                query={query}
                links={links}
                exhibitsById={exhibitsById}
                onOpenExhibit={(id) => setParam('ex', id)}
                onUnlink={unlink}
                selection={selection}
                onSelect={onSelect}
                onLink={(n) => { setLinkLine(n); setLinkTarget(rightId ?? '') }}
                focusLine={Number(params.get('line')) || undefined}
              />
            ) : <Spinner />}
          </div>
        </Card>

        {/* Divider */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panes"
          aria-valuenow={Math.round(split)}
          tabIndex={0}
          onPointerDown={startDrag}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setSplit((s) => Math.max(25, s - 5))
            if (e.key === 'ArrowRight') setSplit((s) => Math.min(75, s + 5))
          }}
          className="group flex w-4 shrink-0 cursor-col-resize items-center justify-center"
        >
          <div className="h-16 w-1 rounded-full bg-line group-hover:bg-accent" />
        </div>

        {/* Right: exhibit */}
        <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" data-tour="review-exhibit">
          <div className="flex items-center gap-2 border-b border-line p-3">
            <ExhibitPicker value={rightId} onChange={(v) => setParam('ex', v)} exhibits={exhibits} label="Choose an exhibit" />
            {rightId && (
              <Button size="sm" variant="ghost" icon="external" onClick={() => navigate(`/juror/evidence/${rightId}`)}>Open</Button>
            )}
          </div>
          <div className="min-h-0 flex-1">
            {rightId ? (
              <ExhibitViewer key={rightId} exhibitId={rightId} focusLine={rightLine} onOpenExhibit={(id) => setParam('ex', id)} />
            ) : (
              <div className="p-6"><EmptyState icon="columns" title="Pick an exhibit to compare">Or click a linked exhibit chip in the transcript.</EmptyState></div>
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={linkLine !== null}
        onClose={() => setLinkLine(null)}
        title={`Link line ${linkLine} to an exhibit`}
        footer={<>
          <Button variant="ghost" onClick={() => setLinkLine(null)}>Cancel</Button>
          <Button variant="primary" disabled={!linkTarget} onClick={createLink}>Create link</Button>
        </>}
      >
        <p className="mb-4 text-muted">Everyone on the jury will see this link. Clicking it opens the exhibit in the right-hand pane.</p>
        <Field label="Exhibit">
          {(id) => (
            <Select id={id} value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)}>
              <option value="">Choose…</option>
              {exhibits.filter((e) => e.id !== transcriptId).map((e) => <option key={e.id} value={e.id}>{e.number}: {e.title}</option>)}
            </Select>
          )}
        </Field>
      </Modal>
    </div>
  )
}
