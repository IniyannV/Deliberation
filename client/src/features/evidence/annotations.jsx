import { useMemo, useRef, useState } from 'react'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { Button, IconButton, Textarea, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import { NoteCard, clamp01 } from './NoteCard'

/*
 * Shared annotation layer for PDF pages and images: point comments,
 * highlight boxes, pen strokes and an eraser. Every annotation is stored as
 * fractions (0..1) of its surface, so the same note survives zoom and resize.
 * A "surface" is the positioned element an annotation sits on — one per PDF
 * page, or the image wrapper (always page 1).
 */

export const ANNOTATION_COLORS = {
  yellow: {
    id: 'yellow',
    name: 'Yellow',
    pinBg: 'bg-[#ffe600] text-amber-950 border-[#cca300]',
    highlightBg: 'bg-[#ffe600]/35 border-[#cca300]/70',
    drawStroke: '#d9a300',
    swatch: 'bg-[#ffe600] border-[#cca300]',
    dot: 'bg-[#ffe600]',
  },
  green: {
    id: 'green',
    name: 'Green',
    pinBg: 'bg-[#30d158] text-white border-[#24a043]',
    highlightBg: 'bg-[#30d158]/30 border-[#24a043]/70',
    drawStroke: '#24a043',
    swatch: 'bg-[#30d158] border-[#24a043]',
    dot: 'bg-[#30d158]',
  },
  blue: {
    id: 'blue',
    name: 'Blue',
    pinBg: 'bg-[#0a84ff] text-white border-[#005bb5]',
    highlightBg: 'bg-[#0a84ff]/30 border-[#005bb5]/70',
    drawStroke: '#0071e3',
    swatch: 'bg-[#0a84ff] border-[#005bb5]',
    dot: 'bg-[#0a84ff]',
  },
  red: {
    id: 'red',
    name: 'Coral',
    pinBg: 'bg-[#ff453a] text-white border-[#c92a20]',
    highlightBg: 'bg-[#ff453a]/30 border-[#c92a20]/70',
    drawStroke: '#e0382e',
    swatch: 'bg-[#ff453a] border-[#c92a20]',
    dot: 'bg-[#ff453a]',
  },
}

// Eraser reach in screen pixels, measured from the pointer to a stroke's centre line
const ERASER_RADIUS = 14
const ERASER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><circle cx="15" cy="15" r="${ERASER_RADIUS}" fill="rgba(255,255,255,0.35)" stroke="#555" stroke-width="1.5" stroke-dasharray="3 2"/></svg>`,
)}") 15 15, crosshair`

const onPage = (n, page) => n.page === page || (!n.page && page === 1)
const isPin = (n) => !n.kind || n.kind === 'note'
const isErasable = (n) => n.kind === 'drawing' || n.kind === 'highlight'

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

// Does an eraser centred at (px, py) — in surface pixels — touch this annotation?
function eraserTouches(n, px, py, w, h) {
  if (n.kind === 'highlight') {
    const left = n.x * w - ERASER_RADIUS
    const top = n.y * h - ERASER_RADIUS
    const right = (n.x + (n.width ?? 0.2)) * w + ERASER_RADIUS
    const bottom = (n.y + (n.height ?? 0.05)) * h + ERASER_RADIUS
    return px >= left && px <= right && py >= top && py <= bottom
  }
  const pts = n.points ?? []
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i]
    const [bx, by] = pts[i + 1] ?? pts[i]
    if (distToSegment(px, py, ax * w, ay * h, bx * w, by * h) <= ERASER_RADIUS + 2) return true
  }
  return false
}

/**
 * Annotation state for one exhibit. `surfaceFor(page)` returns the element
 * annotations on that page are positioned against.
 */
export function useAnnotator({ exhibitId, surfaceFor, onToolChange }) {
  const emit = useLive((s) => s.emit)
  const allNotes = useLive((s) => s.notes)
  const notes = useMemo(
    () => (exhibitId ? allNotes.filter((n) => n.exhibitId === exhibitId) : []),
    [allNotes, exhibitId],
  )

  const [tool, setToolState] = useState('navigate') // 'navigate' | 'note' | 'highlight' | 'draw' | 'eraser'
  const [color, setColor] = useState('yellow')
  const [showAnnotations, setShowAnnotations] = useState(true)

  // In-progress drafts
  const [draftNote, setDraftNote] = useState(null) // { page, x, y, text, quote, color }
  const [draftHighlight, setDraftHighlight] = useState(null) // { page, startX, startY, currentX, currentY }
  const [draftDrawing, setDraftDrawing] = useState(null) // { page, points }
  const [erasing, setErasing] = useState(null) // { page, ids } — strokes the eraser has passed over
  const [moving, setMoving] = useState(null) // { id, x, y, page }
  const [openId, setOpenId] = useState(null) // ID of active note / highlight popover
  const [editText, setEditText] = useState(null)

  const justDragged = useRef(false)
  const isInteracting = useRef(false)
  const eraserLast = useRef(null) // last eraser position in surface pixels

  async function run(event, payload, done) {
    try {
      await emit(event, payload)
      done?.()
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  function setTool(next) {
    setToolState(next)
    setOpenId(null)
    if (next !== 'note') setDraftNote(null)
    if (next !== 'navigate') setShowAnnotations(true)
    onToolChange?.(next)
  }

  // Calculate coordinates as fraction (0..1) of the page surface
  const getFraction = (clientX, clientY, page) => {
    const el = surfaceFor(page)
    if (!el) return { x: 0.5, y: 0.5 }
    const r = el.getBoundingClientRect()
    return {
      x: clamp01((clientX - r.left) / r.width),
      y: clamp01((clientY - r.top) / r.height),
    }
  }

  // Start a new point comment (right-click, long-press, or a text selection)
  function startNote(page, x, y, quote) {
    setShowAnnotations(true)
    setOpenId(null)
    setDraftHighlight(null)
    setDraftDrawing(null)
    setDraftNote({ page, x, y, quote, text: '', color })
  }

  function startNoteAt(page, clientX, clientY) {
    const pos = getFraction(clientX, clientY, page)
    startNote(page, pos.x, pos.y)
  }

  // Collect every erasable annotation the eraser touched since the last pointer event.
  // Samples the path between events so a quick swipe doesn't skip thin strokes.
  function eraseAlong(clientX, clientY, page) {
    const el = surfaceFor(page)
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = clientX - r.left
    const py = clientY - r.top
    const last = eraserLast.current ?? { x: px, y: py }
    eraserLast.current = { x: px, y: py }
    const steps = Math.max(1, Math.ceil(Math.hypot(px - last.x, py - last.y) / (ERASER_RADIUS / 2)))
    const samples = Array.from({ length: steps + 1 }, (_, i) => [
      last.x + ((px - last.x) * i) / steps,
      last.y + ((py - last.y) * i) / steps,
    ])
    const hit = notes
      .filter((n) => onPage(n, page) && isErasable(n))
      .filter((n) => samples.some(([sx, sy]) => eraserTouches(n, sx, sy, r.width, r.height)))
      .map((n) => n.id)
    if (!hit.length) return
    setErasing((prev) => {
      const ids = prev?.ids ?? []
      const fresh = hit.filter((id) => !ids.includes(id))
      return fresh.length ? { page, ids: [...ids, ...fresh] } : prev
    })
  }

  // Pointer interactions on a surface
  const pointerDown = (e, page) => {
    if (e.button !== 0) return // only primary click
    const pos = getFraction(e.clientX, e.clientY, page)

    if (tool === 'note') {
      e.stopPropagation()
      startNote(page, pos.x, pos.y)
      return
    }
    if (tool === 'navigate') return

    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    isInteracting.current = true
    setOpenId(null)

    if (tool === 'highlight') {
      setDraftHighlight({ page, startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y })
    } else if (tool === 'draw') {
      setDraftDrawing({ page, points: [[pos.x, pos.y]] })
    } else if (tool === 'eraser') {
      eraserLast.current = null
      setErasing({ page, ids: [] })
      eraseAlong(e.clientX, e.clientY, page)
    }
  }

  const pointerMove = (e, page) => {
    if (!isInteracting.current) return

    if (erasing && erasing.page === page) {
      eraseAlong(e.clientX, e.clientY, page)
      return
    }

    const pos = getFraction(e.clientX, e.clientY, page)

    if (draftHighlight && draftHighlight.page === page) {
      setDraftHighlight((prev) => (prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null))
      return
    }

    if (draftDrawing && draftDrawing.page === page) {
      setDraftDrawing((prev) => {
        if (!prev) return null
        const pts = prev.points
        const last = pts[pts.length - 1]
        if (!last || Math.hypot(pos.x - last[0], pos.y - last[1]) > 0.003) {
          return { ...prev, points: [...pts, [pos.x, pos.y]] }
        }
        return prev
      })
    }
  }

  // Drafts are cleared before saving so a quick next stroke isn't wiped when this save resolves
  const pointerUp = async (e, page) => {
    if (!isInteracting.current) return
    isInteracting.current = false

    if (erasing && erasing.page === page) {
      const { ids } = erasing
      eraserLast.current = null
      if (ids.length) {
        try {
          await Promise.all(ids.map((id) => emit('note:delete', { id })))
        } catch (err) {
          toast(err.message, { tone: 'error' })
        }
      }
      // Keep the erased strokes faded until the server confirms, unless a new swipe has started
      setErasing((prev) => (prev?.ids === ids ? null : prev))
      return
    }

    if (draftHighlight && draftHighlight.page === page) {
      setDraftHighlight(null)
      const pos = getFraction(e.clientX, e.clientY, page)
      const x0 = draftHighlight.startX
      const y0 = draftHighlight.startY
      const rawW = Math.abs(pos.x - x0)
      const rawH = Math.abs(pos.y - y0)

      if (rawW > 0.015 || rawH > 0.01) {
        await run('note:create', {
          exhibitId,
          page,
          kind: 'highlight',
          color,
          x: Math.min(x0, pos.x),
          y: Math.min(y0, pos.y),
          width: Math.max(0.03, rawW),
          height: Math.max(0.015, rawH),
        })
      }
      return
    }

    if (draftDrawing && draftDrawing.page === page) {
      setDraftDrawing(null)
      if (draftDrawing.points.length >= 2) {
        await run('note:create', { exhibitId, page, kind: 'drawing', color, points: draftDrawing.points })
      }
    }
  }

  const pointerCancel = () => {
    isInteracting.current = false
    eraserLast.current = null
    setDraftHighlight(null)
    setDraftDrawing(null)
    setErasing(null)
  }

  // Pin drag interaction. A press without movement is a tap and opens the note.
  const pinDown = (e, note, page) => {
    if (e.button !== 0) return
    e.stopPropagation()
    if (!surfaceFor(page)) return

    const x0 = e.clientX
    const y0 = e.clientY
    let pos = null
    justDragged.current = false

    const move = (ev) => {
      if (!pos && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return
      pos = getFraction(ev.clientX, ev.clientY, page)
      setMoving({ id: note.id, ...pos, page })
    }

    const up = async () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!pos) return
      justDragged.current = true
      await run('note:move', { id: note.id, ...pos, page })
      setMoving(null)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const placedNotes = notes.map((n) => (moving?.id === n.id ? { ...n, x: moving.x, y: moving.y } : n))
  const pinNotes = placedNotes.filter(isPin)
  const pinNumber = (id) => pinNotes.findIndex((n) => n.id === id) + 1

  return {
    exhibitId, notes, placedNotes, pinNumber,
    tool, setTool, color, setColor, showAnnotations, setShowAnnotations,
    draftNote, setDraftNote, draftHighlight, draftDrawing, erasing, moving,
    openId, setOpenId, editText, setEditText, justDragged,
    run, startNote, startNoteAt, pinDown,
    pointerDown, pointerMove, pointerUp, pointerCancel,
  }
}

const TOOLS = [
  { id: 'note', label: 'Point Comment', icon: 'pin', title: 'Click anywhere to drop a comment at that exact point' },
  { id: 'highlight', label: 'Highlight', icon: 'highlighter' },
  { id: 'draw', label: 'Pen', icon: 'edit' },
  { id: 'eraser', label: 'Eraser', icon: 'eraser', title: 'Drag across pen strokes or highlights to erase them' },
]

/**
 * Tool picker and color palette. Labels collapse to icons when the viewer is
 * narrow, so render it inside an `@container`.
 */
export function AnnotationTools({ a, navigateLabel = 'Read & Select' }) {
  const tools = [{ id: 'navigate', label: navigateLabel, icon: 'search' }, ...TOOLS]
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex rounded-xl bg-fill/70 p-0.5 border border-line/40">
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => a.setTool(t.id)}
            aria-pressed={a.tool === t.id}
            aria-label={t.label}
            className={cx(
              'pressable flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all @2xl:py-1',
              a.tool === t.id ? 'bg-surface text-ink shadow-xs' : 'text-muted hover:text-ink',
            )}
            title={t.title ?? t.label}
          >
            <Icon name={t.icon} size={13} className={t.id !== 'navigate' ? 'text-accent' : undefined} />
            <span className="hidden @2xl:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Color palette */}
      {a.tool !== 'navigate' && a.tool !== 'eraser' && (
        <div className="flex items-center gap-1 pl-1">
          {Object.values(ANNOTATION_COLORS).map((cDef) => (
            <button
              key={cDef.id}
              type="button"
              onClick={() => a.setColor(cDef.id)}
              className={cx(
                'h-5 w-5 rounded-full border transition-transform',
                cDef.swatch,
                a.color === cDef.id ? 'scale-115 ring-2 ring-accent ring-offset-1' : 'opacity-70 hover:opacity-100',
              )}
              title={cDef.name}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Show/hide switch for every annotation on the exhibit. */
export function AnnotationsToggle({ a }) {
  if (!a.notes.length) return null
  return (
    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
      <input
        type="checkbox"
        role="switch"
        checked={a.showAnnotations}
        onChange={(e) => a.setShowAnnotations(e.target.checked)}
        className="switch scale-90"
      />
      <span className="flex items-center gap-1.5 text-muted hover:text-ink">
        <Icon name="highlighter" size={14} className="text-accent" />
        Comments ({a.notes.length})
      </span>
    </label>
  )
}

/** Banner explaining the tools that don't explain themselves. */
export function AnnotationHint({ a, surface = 'document' }) {
  const hint =
    a.tool === 'note'
      ? { icon: 'pin', title: 'Point Comment Mode:', text: `Tap or click anywhere on the ${surface} to attach a comment at that exact spot.` }
      : a.tool === 'eraser'
        ? { icon: 'eraser', title: 'Eraser:', text: 'Drag across pen strokes or highlights to erase them. Comments are deleted from their own card.' }
        : null
  if (!hint) return null
  return (
    <div className="flex items-center justify-center gap-2 border-b border-accent/20 bg-accent-soft/40 px-4 py-1.5 text-xs text-accent">
      <Icon name={hint.icon} size={13} />
      <span><b>{hint.title}</b> {hint.text}</span>
      <button
        type="button"
        onClick={() => a.setTool('navigate')}
        className="ml-2 font-semibold underline hover:no-underline"
      >
        Done
      </button>
    </div>
  )
}

/**
 * Highlights, pen strokes, pins and the comment card for one surface. Render
 * it inside the positioned element `surfaceFor(page)` returns.
 */
export function AnnotationLayer({ a, page, paged = false }) {
  if (!a.showAnnotations) return null

  const { tool, color, openId, draftNote, draftHighlight, draftDrawing, erasing, moving, editText, run } = a
  const pageNotes = a.placedNotes.filter((n) => onPage(n, page))
  const pageHighlights = pageNotes.filter((n) => n.kind === 'highlight')
  const pageDrawings = pageNotes.filter((n) => n.kind === 'drawing')
  const pagePins = pageNotes.filter(isPin)
  const erased = (id) => erasing?.ids.includes(id)
  const where = paged ? ` · Page ${page}` : ''

  const activeNote =
    (draftNote && draftNote.page === page && draftNote) ||
    pagePins.find((n) => n.id === openId)

  return (
    <>
      <div
        onPointerDown={(e) => a.pointerDown(e, page)}
        onPointerMove={(e) => a.pointerMove(e, page)}
        onPointerUp={(e) => a.pointerUp(e, page)}
        onPointerCancel={a.pointerCancel}
        className={cx(
          'absolute inset-0 z-10 select-none overflow-hidden',
          tool === 'navigate' ? 'pointer-events-none' : 'pointer-events-auto touch-none',
          (tool === 'highlight' || tool === 'draw') && 'cursor-crosshair',
          tool === 'note' && 'cursor-copy',
        )}
        style={tool === 'eraser' ? { cursor: ERASER_CURSOR } : undefined}
      >
        {/* 1. Highlight Rectangles */}
        {pageHighlights.map((h) => {
          const cDef = ANNOTATION_COLORS[h.color] || ANNOTATION_COLORS.yellow
          const isSelected = openId === h.id
          return (
            <div key={h.id}>
              <div
                style={{
                  left: `${h.x * 100}%`,
                  top: `${h.y * 100}%`,
                  width: `${(h.width ?? 0.2) * 100}%`,
                  height: `${(h.height ?? 0.05) * 100}%`,
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (tool === 'eraser') return
                  a.setOpenId(isSelected ? null : h.id)
                  a.setDraftNote(null)
                }}
                className={cx(
                  'pointer-events-auto absolute rounded-xs border transition-all duration-150',
                  tool !== 'eraser' && 'cursor-pointer',
                  cDef.highlightBg,
                  erased(h.id) && 'opacity-20',
                  isSelected ? 'ring-2 ring-accent shadow-md z-20' : 'hover:opacity-90 z-10',
                )}
                title={tool === 'eraser' ? undefined : 'Highlight (click for options)'}
              />

              {/* Highlight Popover Bar */}
              {isSelected && (
                <div
                  className="material materialize absolute z-30 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 shadow-xl -translate-y-full -mt-2 border border-line/60"
                  style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted mr-0.5">
                    Highlight
                  </span>
                  {Object.values(ANNOTATION_COLORS).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={cx(
                        'h-4 w-4 rounded-full border',
                        c.swatch,
                        (h.color || 'yellow') === c.id && 'ring-2 ring-accent ring-offset-1',
                      )}
                      onClick={() => run('note:update', { id: h.id, color: c.id })}
                      title={c.name}
                    />
                  ))}
                  <div className="h-3 w-px bg-line/60 mx-1" />
                  <IconButton
                    icon="trash"
                    label="Delete highlight"
                    className="text-danger hover:bg-danger-soft p-1 h-6 w-6"
                    onClick={() => run('note:delete', { id: h.id }, () => a.setOpenId(null))}
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Draft Highlight Preview */}
        {draftHighlight && draftHighlight.page === page && (
          <div
            style={{
              left: `${Math.min(draftHighlight.startX, draftHighlight.currentX) * 100}%`,
              top: `${Math.min(draftHighlight.startY, draftHighlight.currentY) * 100}%`,
              width: `${Math.abs(draftHighlight.currentX - draftHighlight.startX) * 100}%`,
              height: `${Math.abs(draftHighlight.currentY - draftHighlight.startY) * 100}%`,
            }}
            className={cx(
              'absolute pointer-events-none rounded-xs border-2 border-dashed z-20',
              ANNOTATION_COLORS[color]?.highlightBg || ANNOTATION_COLORS.yellow.highlightBg,
            )}
          />
        )}

        {/* 2. Freehand Drawings */}
        {pageDrawings.map((d) => {
          const cDef = ANNOTATION_COLORS[d.color] || ANNOTATION_COLORS.yellow
          const isSelected = openId === d.id
          return (
            <div key={d.id} className="absolute inset-0 pointer-events-none">
              <svg
                viewBox="0 0 1000 1000"
                preserveAspectRatio="none"
                className={cx(
                  'pointer-events-none absolute inset-0 h-full w-full overflow-visible transition-opacity',
                  erased(d.id) && 'opacity-20',
                )}
              >
                <polyline
                  points={(d.points ?? []).map(([px, py]) => `${px * 1000},${py * 1000}`).join(' ')}
                  fill="none"
                  stroke={cDef.drawStroke}
                  strokeWidth={isSelected ? '5' : '3.5'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className={cx('pointer-events-auto', tool !== 'eraser' && 'cursor-pointer')}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (tool === 'eraser') return
                    a.setOpenId(isSelected ? null : d.id)
                  }}
                />
              </svg>

              {/* Drawing selection action pill */}
              {isSelected && d.points?.[0] && (
                <div
                  className="material materialize pointer-events-auto absolute z-30 flex items-center gap-1.5 rounded-xl px-2 py-1 shadow-xl -translate-y-full -mt-2 border border-line/60"
                  style={{ left: `${d.points[0][0] * 100}%`, top: `${d.points[0][1] * 100}%` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[0.6875rem] font-bold text-muted uppercase">Pen Stroke</span>
                  <IconButton
                    icon="trash"
                    label="Delete stroke"
                    className="text-danger hover:bg-danger-soft p-1 h-6 w-6"
                    onClick={() => run('note:delete', { id: d.id }, () => a.setOpenId(null))}
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Draft Drawing Preview */}
        {draftDrawing && draftDrawing.page === page && draftDrawing.points.length >= 2 && (
          <svg
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible z-20"
          >
            <polyline
              points={draftDrawing.points.map(([px, py]) => `${px * 1000},${py * 1000}`).join(' ')}
              fill="none"
              stroke={ANNOTATION_COLORS[color]?.drawStroke || '#d9a300'}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {/* 3. Pinned Point Notes */}
        {pagePins.map((n) => {
          const cDef = ANNOTATION_COLORS[n.color] || ANNOTATION_COLORS.yellow
          const num = a.pinNumber(n.id)
          const isOpen = n.id === openId
          return (
            <div key={n.id} className="absolute pointer-events-none" style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%` }}>
              {/* Precision Target Dot on the exact word/pixel */}
              <span className="absolute -translate-x-1/2 -translate-y-1/2 flex h-3 w-3 items-center justify-center pointer-events-none z-15">
                {isOpen && <span className={cx('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', cDef.dot)} />}
                <span className={cx('relative inline-flex rounded-full h-2 w-2 ring-1 ring-white shadow-xs', cDef.dot)} />
              </span>

              {/* Clickable Pin Button */}
              <button
                type="button"
                onPointerDown={(e) => a.pinDown(e, n, page)}
                onClick={(e) => {
                  e.stopPropagation()
                  if (a.justDragged.current) {
                    a.justDragged.current = false
                    return
                  }
                  a.setOpenId(isOpen ? null : n.id)
                  a.setEditText(n.text)
                  a.setDraftNote(null)
                }}
                className={cx(
                  'pointer-events-auto no-callout absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-full border-2 text-xs font-bold shadow-md transition-all duration-200 active:cursor-grabbing z-20',
                  cDef.pinBg,
                  isOpen ? 'scale-115 ring-4 shadow-lg ring-accent/30' : 'hover:scale-110',
                  moving?.id === n.id && 'z-30 scale-125 shadow-xl',
                )}
                aria-label={`Comment #${num} at point: ${n.text}`}
              >
                {num}
              </button>
            </div>
          )
        })}

        {/* Point indicator for new draft note */}
        {draftNote && draftNote.page === page && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-25"
            style={{ left: `${draftNote.x * 100}%`, top: `${draftNote.y * 100}%` }}
          >
            <span className="relative flex h-4 w-4 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent/60 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent ring-2 ring-white shadow-sm" />
            </span>
          </div>
        )}
      </div>

      {/* NoteCard for editing or viewing a selected point comment or draft */}
      {activeNote && (
        <NoteCard
          x={activeNote.x}
          y={activeNote.y}
          label={draftNote ? 'New comment' : `Comment #${a.pinNumber(activeNote.id)}`}
          onClose={() => {
            a.setOpenId(null)
            a.setDraftNote(null)
            a.setEditText(null)
          }}
          pinRadius={14}
          color={ANNOTATION_COLORS[activeNote.color || 'yellow']?.drawStroke}
        >
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-line/40 pb-1.5">
              <span className="text-xs font-semibold text-muted">
                {draftNote
                  ? activeNote.quote
                    ? 'Comment on selected text'
                    : `Comment at Point${where}`
                  : `Comment #${a.pinNumber(activeNote.id)}${where}`}
              </span>
              <div className="flex items-center gap-1">
                {Object.values(ANNOTATION_COLORS).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={cx(
                      'h-3.5 w-3.5 rounded-full border',
                      c.swatch,
                      (draftNote ? draftNote.color : (activeNote.color || 'yellow')) === c.id &&
                        'ring-2 ring-accent ring-offset-1',
                    )}
                    onClick={() => {
                      if (draftNote) a.setDraftNote({ ...draftNote, color: c.id })
                      else run('note:update', { id: activeNote.id, color: c.id })
                    }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {/* Quoted text excerpt if anchored to selection */}
            {activeNote.quote && (
              <div className="rounded-xl bg-fill/60 border border-line/40 p-2 text-xs text-ink/90 italic leading-relaxed">
                &ldquo;{activeNote.quote}&rdquo;
              </div>
            )}

            {draftNote ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!draftNote.text.trim()) return
                  run('note:create', {
                    exhibitId: a.exhibitId,
                    page,
                    kind: 'note',
                    color: draftNote.color,
                    x: draftNote.x,
                    y: draftNote.y,
                    quote: draftNote.quote || undefined,
                    text: draftNote.text.trim(),
                  }, () => a.setDraftNote(null))
                }}
                className="flex flex-col gap-2"
              >
                <Textarea
                  value={draftNote.text}
                  onChange={(e) => a.setDraftNote({ ...draftNote, text: e.target.value })}
                  placeholder="Write your comment on this specific point…"
                  rows={3}
                  maxLength={500}
                  autoFocus
                  className="text-sm"
                />
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => a.setDraftNote(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="primary" type="submit" disabled={!draftNote.text.trim()}>
                    Save Comment
                  </Button>
                </div>
              </form>
            ) : editText !== null ? (
              <div className="flex flex-col gap-2">
                <Textarea
                  value={editText}
                  onChange={(e) => a.setEditText(e.target.value)}
                  rows={3}
                  maxLength={500}
                  autoFocus
                  className="text-sm"
                />
                <div className="flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => run('note:delete', { id: activeNote.id }, () => a.setOpenId(null))}
                  >
                    Delete
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => a.setEditText(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!editText.trim()}
                      onClick={() =>
                        run('note:update', { id: activeNote.id, text: editText.trim() }, () => a.setEditText(null))
                      }
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm whitespace-pre-wrap leading-relaxed text-ink">{activeNote.text}</p>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-line/30 text-xs text-muted">
                  <span>
                    {activeNote.createdAt
                      ? new Date(activeNote.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                      : ''}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => a.setEditText(activeNote.text)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => run('note:delete', { id: activeNote.id }, () => a.setOpenId(null))}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </NoteCard>
      )}
    </>
  )
}
