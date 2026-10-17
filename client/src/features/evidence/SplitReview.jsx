import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { load, store } from '../../lib/storage'
import { Button, Card, EmptyState, Field, IconButton, Input, Modal, Select, Spinner, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useExhibit } from './useExhibit'
import ExhibitViewer from './ExhibitViewer'
import TranscriptView from './TranscriptView'
import Enlargeable from './Enlargeable'

// Past a limit the pane follows less and less, like pulling against a spring.
function rubberband(value, min, max, dimension = 50, c = 0.55) {
  const over = value < min ? value - min : value > max ? value - max : 0
  if (!over) return value
  const eased = (over * dimension * c) / (dimension + c * Math.abs(over))
  return (over < 0 ? min : max) + eased
}

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
  const firstTranscript = exhibits.find((e) => e.type === 'transcript')

  // Either side can hold any exhibit. The left side opens on a transcript by default,
  // and only a transcript gets line selection, find and linking.
  const leftId = params.get('t') ?? (firstTranscript ?? exhibits[0])?.id ?? null
  const rightId = params.get('ex')
  const rightLine = Number(params.get('rline')) || undefined
  const { exhibit: left } = useExhibit(leftId)
  const transcript = left?.type === 'transcript' ? left : null
  const transcriptId = transcript?.id ?? null
  const [enlarged, setEnlarged] = useState(null) // 'left' | 'right' | null

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

  useEffect(() => setSelection(null), [leftId])

  /*
   * Draggable divider between the panes. It tracks the pointer 1:1 from
   * wherever it was grabbed; past the 25–75% limits it resists progressively
   * instead of stopping dead, then springs back to the limit on release.
   */
  const [settling, setSettling] = useState(false)
  const startDrag = useCallback((e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setSettling(false)
    const box = container.current.getBoundingClientRect()
    const toPct = (x) => ((x - box.left) / box.width) * 100
    const grabOffset = toPct(e.clientX) - split
    let raw = split
    const move = (ev) => {
      raw = toPct(ev.clientX) - grabOffset
      setSplit(rubberband(raw, 25, 75))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      const final = Math.min(75, Math.max(25, raw))
      setSettling(true)
      setSplit(final)
      store('splitPct', final)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }, [split])

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

  if (!exhibits.length) return <EmptyState icon="columns" title="No exhibits yet">Exhibits appear here once the clerk loads them.</EmptyState>
  const leftSummary = exhibitsById[leftId]
  const rightSummary = exhibitsById[rightId]

  return (
    <div className="flex h-[calc(100dvh-var(--page-chrome,4rem))] flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Side-by-side review</h1>
        <p className="text-muted">
          Choose any exhibit for either side.
          {transcript && <> Tap a line number to select it (Shift-click for a range); use <Icon name="link" size={16} className="inline" /> to link a line to an exhibit.</>}
        </p>
      </div>

      <div ref={container} className="flex min-h-0 flex-1">
        {/* Left: transcript */}
        <Card
          className={cx('flex min-h-0 min-w-0 flex-col overflow-hidden', settling && 'motion-travel transition-[width] duration-500 ease-[var(--ease-spring)]')}
          style={{ width: `${split}%` }}
          onTransitionEnd={() => setSettling(false)}
          data-tour="review-transcript"
        >
          <Enlargeable exhibit={leftSummary ?? { number: '', title: '' }} enlarged={enlarged === 'left'} onExit={() => setEnlarged(null)} className="min-h-0 flex-1">
            <div className="flex h-full flex-col">
              <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
                <ExhibitPicker value={leftId} onChange={(v) => setParam('t', v)} exhibits={exhibits} label="Choose an exhibit" />
                {transcript && (
                  <label className="relative w-40">
                    <span className="sr-only">Find in transcript</span>
                    <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
                    <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find…" className="py-1.5 pl-8" />
                  </label>
                )}
                {leftId && enlarged !== 'left' && <IconButton icon="maximize" label="Full screen" onClick={() => setEnlarged('left')} />}
              </div>
              {transcript && selection && (
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
              {!leftId ? (
                <div className="p-6"><EmptyState icon="columns" title="Pick an exhibit">Choose what to show on this side.</EmptyState></div>
              ) : transcript ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin">
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
                </div>
              ) : left ? (
                <div className="min-h-0 flex-1">
                  <ExhibitViewer key={leftId} exhibitId={leftId} onOpenExhibit={(id) => setParam('ex', id)} />
                </div>
              ) : <Spinner />}
            </div>
          </Enlargeable>
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
            if (e.key === 'ArrowLeft') { setSettling(true); setSplit((s) => Math.max(25, s - 5)) }
            if (e.key === 'ArrowRight') { setSettling(true); setSplit((s) => Math.min(75, s + 5)) }
          }}
          className="group flex w-4 shrink-0 cursor-col-resize touch-none items-center justify-center"
        >
          <div className="h-16 w-1 rounded-full bg-line transition-[background-color,height,width] duration-200 ease-[var(--ease-fluid)] group-hover:bg-accent group-active:h-24 group-active:w-1.5 group-active:bg-accent" />
        </div>

        {/* Right: exhibit */}
        <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" data-tour="review-exhibit">
          <Enlargeable exhibit={rightSummary ?? { number: '', title: '' }} enlarged={enlarged === 'right'} onExit={() => setEnlarged(null)} className="min-h-0 flex-1">
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2 border-b border-line p-3">
                <ExhibitPicker value={rightId} onChange={(v) => setParam('ex', v)} exhibits={exhibits} label="Choose an exhibit" />
                {rightId && enlarged !== 'right' && <IconButton icon="maximize" label="Full screen" onClick={() => setEnlarged('right')} />}
                {rightId && (
                  <Button size="sm" variant="ghost" icon="external" onClick={() => navigate(`/juror/evidence/${rightId}`)}>Open</Button>
                )}
              </div>
              <div className="min-h-0 flex-1">
                {rightId ? (
                  <ExhibitViewer key={rightId} exhibitId={rightId} focusLine={rightLine} onOpenExhibit={(id) => setParam('ex', id)} />
                ) : (
                  <div className="p-6"><EmptyState icon="columns" title="Pick an exhibit to compare">Or tap a linked exhibit chip in a transcript.</EmptyState></div>
                )}
              </div>
            </div>
          </Enlargeable>
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
