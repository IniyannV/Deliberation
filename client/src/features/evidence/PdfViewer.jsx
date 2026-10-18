import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { fileProblem } from '../../lib/api'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { useLongPress } from '../../lib/touch'
import { Button, IconButton, Textarea, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import { PDF_OPTIONS } from './pdfSetup'
import { NoteCard, clamp01 } from './NoteCard'

const ANNOTATION_COLORS = {
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

export default function PdfViewer({ exhibit, url, title }) {
  const box = useRef(null)
  const pageRefs = useRef({})
  const justDragged = useRef(false)
  const isInteracting = useRef(false)

  const emit = useLive((s) => s.emit)
  const allNotes = useLive((s) => s.notes)
  const exhibitId = exhibit?.id

  // Notes and annotations specific to this exhibit
  const notes = useMemo(
    () => (exhibitId ? allNotes.filter((n) => n.exhibitId === exhibitId) : []),
    [allNotes, exhibitId],
  )

  const [width, setWidth] = useState(600)
  const [pages, setPages] = useState(0)
  const [activePage, setActivePage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState('')

  // Annotation modes & state
  const [tool, setTool] = useState('navigate') // 'navigate' | 'note' | 'highlight' | 'draw'
  const [color, setColor] = useState('yellow')
  const [showAnnotations, setShowAnnotations] = useState(true)

  // Floating text selection action bar
  const [textSelection, setTextSelection] = useState(null) // { page, text, x, y, w, h, clientTop, clientLeft }

  // In-progress drafts
  const [draftNote, setDraftNote] = useState(null) // { page, x, y, text, quote, color }
  const [draftHighlight, setDraftHighlight] = useState(null) // { page, startX, startY, currentX, currentY }
  const [draftDrawing, setDraftDrawing] = useState(null) // { page, points }
  const [moving, setMoving] = useState(null) // { id, x, y, page }
  const [openId, setOpenId] = useState(null) // ID of active note / highlight popover
  const [editText, setEditText] = useState(null)

  // Measure container for responsive page width
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.max(260, entry.contentRect.width - 48))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Track active page via scroll position
  const handleScroll = useCallback(() => {
    const el = box.current
    if (!el || !pages) return
    const elRect = el.getBoundingClientRect()
    const centerY = elRect.top + elRect.height / 3

    for (let p = 1; p <= pages; p++) {
      const pageEl = pageRefs.current[p]
      if (pageEl) {
        const rect = pageEl.getBoundingClientRect()
        if (rect.top <= centerY && rect.bottom >= centerY) {
          setActivePage(p)
          break
        }
      }
    }
  }, [pages])

  const scrollToPage = (p) => {
    const target = Math.max(1, Math.min(pages, p))
    const pageEl = pageRefs.current[target]
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActivePage(target)
    }
  }

  const file = useMemo(() => ({ url }), [url])

  async function run(event, payload, done) {
    try {
      await emit(event, payload)
      done?.()
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  // Calculate coordinates as fraction (0..1) of page container
  const getPageFraction = (clientX, clientY, pageNum) => {
    const pageEl = pageRefs.current[pageNum]
    if (!pageEl) return { x: 0.5, y: 0.5 }
    const r = pageEl.getBoundingClientRect()
    return {
      x: clamp01((clientX - r.left) / r.width),
      y: clamp01((clientY - r.top) / r.height),
    }
  }

  // Detect text selection on mouseup/touchend
  const handleSelectionCheck = useCallback(() => {
    if (tool !== 'navigate') return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setTextSelection(null)
      return
    }
    const range = sel.getRangeAt(0)
    const selectedText = sel.toString().trim()
    if (!selectedText || selectedText.length < 2) {
      setTextSelection(null)
      return
    }

    for (let p = 1; p <= pages; p++) {
      const pageEl = pageRefs.current[p]
      if (pageEl && pageEl.contains(range.commonAncestorContainer)) {
        const pRect = pageEl.getBoundingClientRect()
        const rRect = range.getBoundingClientRect()
        const x = clamp01((rRect.left - pRect.left) / pRect.width)
        const y = clamp01((rRect.top - pRect.top) / pRect.height)
        const w = clamp01(rRect.width / pRect.width)
        const h = clamp01(rRect.height / pRect.height)

        setTextSelection({
          page: p,
          text: selectedText,
          x,
          y,
          w,
          h,
          clientTop: rRect.top,
          clientLeft: rRect.left + rRect.width / 2,
        })
        return
      }
    }
    setTextSelection(null)
  }, [tool, pages])

  useEffect(() => {
    const onMouseUp = () => {
      // Small timeout to allow selection to settle
      setTimeout(handleSelectionCheck, 20)
    }
    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [handleSelectionCheck])

  // Right-click or long-press on any page drops a point comment
  const pinMenu = useLongPress((clientX, clientY, e) => {
    let target = e.target
    while (target && !target.dataset?.pageNumber && target !== box.current) {
      target = target.parentElement
    }
    const pageNum = Number(target?.dataset?.pageNumber) || activePage
    const pos = getPageFraction(clientX, clientY, pageNum)
    setShowAnnotations(true)
    setOpenId(null)
    setDraftHighlight(null)
    setDraftDrawing(null)
    setTextSelection(null)
    setDraftNote({ page: pageNum, x: pos.x, y: pos.y, text: '', color })
  })

  // Pointer interactions on individual pages
  const handlePagePointerDown = (e, pageNum) => {
    if (e.button !== 0) return // only primary click
    const pos = getPageFraction(e.clientX, e.clientY, pageNum)

    if (tool === 'note') {
      e.stopPropagation()
      setDraftNote({ page: pageNum, x: pos.x, y: pos.y, text: '', color })
      setOpenId(null)
      setTextSelection(null)
      return
    }

    if (tool === 'highlight') {
      e.stopPropagation()
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      isInteracting.current = true
      setDraftHighlight({
        page: pageNum,
        startX: pos.x,
        startY: pos.y,
        currentX: pos.x,
        currentY: pos.y,
      })
      return
    }

    if (tool === 'draw') {
      e.stopPropagation()
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      isInteracting.current = true
      setDraftDrawing({
        page: pageNum,
        points: [[pos.x, pos.y]],
      })
    }
  }

  const handlePagePointerMove = (e, pageNum) => {
    if (!isInteracting.current) return
    const pos = getPageFraction(e.clientX, e.clientY, pageNum)

    if (draftHighlight && draftHighlight.page === pageNum) {
      setDraftHighlight((prev) => (prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null))
      return
    }

    if (draftDrawing && draftDrawing.page === pageNum) {
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

  const handlePagePointerUp = async (e, pageNum) => {
    if (!isInteracting.current) return
    isInteracting.current = false

    if (draftHighlight && draftHighlight.page === pageNum) {
      const pos = getPageFraction(e.clientX, e.clientY, pageNum)
      const x0 = draftHighlight.startX
      const y0 = draftHighlight.startY
      const x1 = pos.x
      const y1 = pos.y

      const minX = Math.min(x0, x1)
      const minY = Math.min(y0, y1)
      const rawW = Math.abs(x1 - x0)
      const rawH = Math.abs(y1 - y0)

      if (rawW > 0.015 || rawH > 0.01) {
        const w = Math.max(0.03, rawW)
        const h = Math.max(0.015, rawH)
        await run('note:create', {
          exhibitId,
          page: pageNum,
          kind: 'highlight',
          color,
          x: minX,
          y: minY,
          width: w,
          height: h,
        })
      }
      setDraftHighlight(null)
      return
    }

    if (draftDrawing && draftDrawing.page === pageNum) {
      if (draftDrawing.points.length >= 2) {
        await run('note:create', {
          exhibitId,
          page: pageNum,
          kind: 'drawing',
          color,
          points: draftDrawing.points,
        })
      }
      setDraftDrawing(null)
    }
  }

  // Pin drag interaction
  const pinDown = (e, note, pageNum) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const pageEl = pageRefs.current[pageNum]
    if (!pageEl) return

    const x0 = e.clientX
    const y0 = e.clientY
    let pos = null
    justDragged.current = false

    const move = (ev) => {
      if (!pos && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return
      pos = getPageFraction(ev.clientX, ev.clientY, pageNum)
      setMoving({ id: note.id, ...pos, page: pageNum })
    }

    const up = async () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!pos) return
      justDragged.current = true
      await run('note:move', { id: note.id, ...pos, page: pageNum })
      setMoving(null)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // Filter notes by page and map moving positions
  const placedNotes = notes.map((n) => (moving?.id === n.id ? { ...n, x: moving.x, y: moving.y } : n))
  const pinNotes = placedNotes.filter((n) => !n.kind || n.kind === 'note')
  const pinNumber = (id) => pinNotes.findIndex((n) => n.id === id) + 1

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top Header & Annotation Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line bg-surface/85 px-3 py-2 text-sm backdrop-blur-md">
        {/* Left: Page count, jump, and annotations toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-muted">
            <IconButton
              icon="chevronLeft"
              label="Previous page"
              disabled={activePage <= 1}
              onClick={() => scrollToPage(activePage - 1)}
              className="p-1 h-7 w-7"
            />
            <span className="font-semibold text-ink tabular-nums">
              Page {activePage} of {pages || 1}
            </span>
            <IconButton
              icon="chevronRight"
              label="Next page"
              disabled={activePage >= pages}
              onClick={() => scrollToPage(activePage + 1)}
              className="p-1 h-7 w-7"
            />
          </div>

          <div className="h-4 w-px bg-line/60" />

          {notes.length > 0 && (
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                role="switch"
                checked={showAnnotations}
                onChange={(e) => setShowAnnotations(e.target.checked)}
                className="switch scale-90"
              />
              <span className="flex items-center gap-1.5 text-muted hover:text-ink">
                <Icon name="highlighter" size={14} className="text-accent" />
                Comments ({notes.length})
              </span>
            </label>
          )}
        </div>

        {/* Center: Tool Picker & Color Swatches */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-fill/70 p-0.5 border border-line/40">
            <button
              type="button"
              onClick={() => { setTool('navigate'); setDraftNote(null) }}
              className={cx(
                'pressable flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
                tool === 'navigate' ? 'bg-surface text-ink shadow-xs' : 'text-muted hover:text-ink',
              )}
            >
              <Icon name="search" size={13} />
              Read &amp; Select
            </button>
            <button
              type="button"
              onClick={() => { setTool('note'); setShowAnnotations(true); setTextSelection(null) }}
              className={cx(
                'pressable flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
                tool === 'note' ? 'bg-surface text-ink shadow-xs' : 'text-muted hover:text-ink',
              )}
              title="Click anywhere to drop a comment at that exact point"
            >
              <Icon name="pin" size={13} className="text-accent" />
              Point Comment
            </button>
            <button
              type="button"
              onClick={() => { setTool('highlight'); setShowAnnotations(true); setDraftNote(null); setTextSelection(null) }}
              className={cx(
                'pressable flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
                tool === 'highlight' ? 'bg-surface text-ink shadow-xs' : 'text-muted hover:text-ink',
              )}
            >
              <Icon name="highlighter" size={13} className="text-accent" />
              Highlight
            </button>
            <button
              type="button"
              onClick={() => { setTool('draw'); setShowAnnotations(true); setDraftNote(null); setTextSelection(null) }}
              className={cx(
                'pressable flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
                tool === 'draw' ? 'bg-surface text-ink shadow-xs' : 'text-muted hover:text-ink',
              )}
            >
              <Icon name="edit" size={13} className="text-accent" />
              Pen
            </button>
          </div>

          {/* Color palette */}
          {tool !== 'navigate' && (
            <div className="flex items-center gap-1 pl-1">
              {Object.keys(ANNOTATION_COLORS).map((cKey) => {
                const cDef = ANNOTATION_COLORS[cKey]
                return (
                  <button
                    key={cKey}
                    type="button"
                    onClick={() => setColor(cKey)}
                    className={cx(
                      'h-5 w-5 rounded-full border transition-transform',
                      cDef.swatch,
                      color === cKey ? 'scale-115 ring-2 ring-accent ring-offset-1' : 'opacity-70 hover:opacity-100',
                    )}
                    title={cDef.name}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Zoom controls */}
        <div className="flex items-center gap-1">
          <IconButton
            icon="minus"
            label="Zoom out"
            size={16}
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
          />
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="w-12 text-center text-xs font-semibold tabular-nums text-muted hover:text-ink"
            title="Reset to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <IconButton
            icon="plus"
            label="Zoom in"
            size={16}
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
          />
        </div>
      </div>

      {/* Floating text selection quick action popover */}
      {textSelection && (
        <div
          className="material materialize fixed z-50 flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-2xl border border-line/60 -translate-x-1/2 -translate-y-full -mt-3"
          style={{ left: textSelection.clientLeft, top: textSelection.clientTop }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              const { page, x, y, text } = textSelection
              setTextSelection(null)
              window.getSelection()?.removeAllRanges()
              setShowAnnotations(true)
              setOpenId(null)
              setDraftNote({
                page,
                x,
                y,
                quote: text.slice(0, 300),
                text: '',
                color,
              })
            }}
            className="pressable flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-accent hover:bg-fill"
          >
            <Icon name="pin" size={13} />
            Comment on selection
          </button>
          <div className="h-3.5 w-px bg-line/60" />
          <button
            type="button"
            onClick={async () => {
              const { page, x, y, w, h } = textSelection
              setTextSelection(null)
              window.getSelection()?.removeAllRanges()
              setShowAnnotations(true)
              await run('note:create', {
                exhibitId,
                page,
                kind: 'highlight',
                color,
                x,
                y,
                width: Math.max(0.04, w),
                height: Math.max(0.015, h),
              })
            }}
            className="pressable flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-ink hover:bg-fill"
          >
            <Icon name="highlighter" size={13} className="text-warn" />
            Highlight
          </button>
        </div>
      )}

      {/* Mode hint banner for Point Comment mode */}
      {tool === 'note' && (
        <div className="flex items-center justify-center gap-2 border-b border-accent/20 bg-accent-soft/40 px-4 py-1.5 text-xs text-accent">
          <Icon name="pin" size={13} />
          <span><b>Point Comment Mode:</b> Tap or click anywhere on the document to attach a comment at that exact spot.</span>
          <button
            type="button"
            onClick={() => setTool('navigate')}
            className="ml-2 font-semibold underline hover:no-underline"
          >
            Done
          </button>
        </div>
      )}

      {/* Main PDF Scrollable Body */}
      <div
        ref={box}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-auto bg-surface-2 p-6 text-center scrollbar-thin"
        aria-label={title}
      >
        {error ? (
          <p className="text-danger py-8">{error}</p>
        ) : (
          <Document
            file={file}
            options={PDF_OPTIONS}
            suspense={false}
            onLoadSuccess={({ numPages }) => setPages(numPages)}
            onLoadError={async (e) => setError((await fileProblem(url)) ?? `Could not open this PDF (${e.message}).`)}
            loading={<p className="text-muted py-8">Opening document…</p>}
          >
            {Array.from({ length: pages }, (_, i) => {
              const pageNum = i + 1
              const pageNotes = placedNotes.filter(
                (n) => (n.page === pageNum) || (!n.page && pageNum === 1),
              )
              const pageHighlights = pageNotes.filter((n) => n.kind === 'highlight')
              const pageDrawings = pageNotes.filter((n) => n.kind === 'drawing')
              const pagePins = pageNotes.filter((n) => !n.kind || n.kind === 'note')

              const activeNote =
                (draftNote && draftNote.page === pageNum && draftNote) ||
                pagePins.find((n) => n.id === openId)

              return (
                <div
                  key={pageNum}
                  ref={(el) => (pageRefs.current[pageNum] = el)}
                  data-page-number={pageNum}
                  {...pinMenu}
                  className="relative mb-8 inline-block shadow-lg rounded-sm text-left bg-white transition-shadow"
                  style={{ width: width * zoom }}
                >
                  <Page
                    pageNumber={pageNum}
                    width={width * zoom}
                    suspense={false}
                    loading=""
                    renderTextLayer={tool === 'navigate'}
                    renderAnnotationLayer={false}
                  />

                  {/* Interactive Annotation Overlay */}
                  {showAnnotations && (
                    <div
                      onPointerDown={(e) => handlePagePointerDown(e, pageNum)}
                      onPointerMove={(e) => handlePagePointerMove(e, pageNum)}
                      onPointerUp={(e) => handlePagePointerUp(e, pageNum)}
                      className={cx(
                        'absolute inset-0 z-10 select-none overflow-hidden',
                        tool === 'navigate' ? 'pointer-events-none' : 'pointer-events-auto touch-none',
                        tool === 'highlight' && 'cursor-crosshair',
                        tool === 'draw' && 'cursor-crosshair',
                        tool === 'note' && 'cursor-copy',
                      )}
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
                                setOpenId(isSelected ? null : h.id)
                                setDraftNote(null)
                              }}
                              className={cx(
                                'pointer-events-auto absolute cursor-pointer rounded-xs border transition-all duration-150',
                                cDef.highlightBg,
                                isSelected ? 'ring-2 ring-accent shadow-md z-20' : 'hover:opacity-90 z-10',
                              )}
                              title="Highlight (click for options)"
                            />

                            {/* Highlight Popover Bar */}
                            {isSelected && (
                              <div
                                className="material materialize absolute z-30 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 shadow-xl -translate-y-full -mt-2 border border-line/60"
                                style={{
                                  left: `${h.x * 100}%`,
                                  top: `${h.y * 100}%`,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted mr-0.5">
                                  Highlight
                                </span>
                                {Object.keys(ANNOTATION_COLORS).map((cKey) => (
                                  <button
                                    key={cKey}
                                    type="button"
                                    className={cx(
                                      'h-4 w-4 rounded-full border',
                                      ANNOTATION_COLORS[cKey].swatch,
                                      (h.color || 'yellow') === cKey && 'ring-2 ring-accent ring-offset-1',
                                    )}
                                    onClick={() => run('note:update', { id: h.id, color: cKey })}
                                    title={ANNOTATION_COLORS[cKey].name}
                                  />
                                ))}
                                <div className="h-3 w-px bg-line/60 mx-1" />
                                <IconButton
                                  icon="trash"
                                  label="Delete highlight"
                                  className="text-danger hover:bg-danger-soft p-1 h-6 w-6"
                                  onClick={() => run('note:delete', { id: h.id }, () => setOpenId(null))}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Draft Highlight Preview */}
                      {draftHighlight && draftHighlight.page === pageNum && (
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
                              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                            >
                              <polyline
                                points={(d.points ?? []).map(([px, py]) => `${px * 1000},${py * 1000}`).join(' ')}
                                fill="none"
                                stroke={cDef.drawStroke}
                                strokeWidth={isSelected ? '5' : '3.5'}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                                className="pointer-events-auto cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenId(isSelected ? null : d.id)
                                }}
                              />
                            </svg>

                            {/* Drawing selection action pill */}
                            {isSelected && d.points?.[0] && (
                              <div
                                className="material materialize pointer-events-auto absolute z-30 flex items-center gap-1.5 rounded-xl px-2 py-1 shadow-xl -translate-y-full -mt-2 border border-line/60"
                                style={{
                                  left: `${d.points[0][0] * 100}%`,
                                  top: `${d.points[0][1] * 100}%`,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[0.6875rem] font-bold text-muted uppercase">Pen Stroke</span>
                                <IconButton
                                  icon="trash"
                                  label="Delete stroke"
                                  className="text-danger hover:bg-danger-soft p-1 h-6 w-6"
                                  onClick={() => run('note:delete', { id: d.id }, () => setOpenId(null))}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Draft Drawing Preview */}
                      {draftDrawing && draftDrawing.page === pageNum && draftDrawing.points.length >= 2 && (
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
                        const num = pinNumber(n.id)
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
                              onPointerDown={(e) => pinDown(e, n, pageNum)}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (justDragged.current) {
                                  justDragged.current = false
                                  return
                                }
                                setOpenId(isOpen ? null : n.id)
                                setEditText(n.text)
                                setDraftNote(null)
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
                      {draftNote && draftNote.page === pageNum && (
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
                  )}

                  {/* NoteCard for editing or viewing a selected point comment or draft */}
                  {showAnnotations && activeNote && (
                    <NoteCard
                      x={activeNote.x}
                      y={activeNote.y}
                      label={draftNote ? 'New comment' : `Comment #${pinNumber(activeNote.id)}`}
                      onClose={() => {
                        setOpenId(null)
                        setDraftNote(null)
                        setEditText(null)
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
                                : `Comment at Point · Page ${pageNum}`
                              : `Comment #${pinNumber(activeNote.id)} · Page ${pageNum}`}
                          </span>
                          <div className="flex items-center gap-1">
                            {Object.keys(ANNOTATION_COLORS).map((cKey) => (
                              <button
                                key={cKey}
                                type="button"
                                className={cx(
                                  'h-3.5 w-3.5 rounded-full border',
                                  ANNOTATION_COLORS[cKey].swatch,
                                  (draftNote ? draftNote.color : (activeNote.color || 'yellow')) === cKey &&
                                    'ring-2 ring-accent ring-offset-1',
                                )}
                                onClick={() => {
                                  if (draftNote) setDraftNote({ ...draftNote, color: cKey })
                                  else run('note:update', { id: activeNote.id, color: cKey })
                                }}
                                title={ANNOTATION_COLORS[cKey].name}
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
                                exhibitId,
                                page: pageNum,
                                kind: 'note',
                                color: draftNote.color,
                                x: draftNote.x,
                                y: draftNote.y,
                                quote: draftNote.quote || undefined,
                                text: draftNote.text.trim(),
                              }, () => setDraftNote(null))
                            }}
                            className="flex flex-col gap-2"
                          >
                            <Textarea
                              value={draftNote.text}
                              onChange={(e) => setDraftNote({ ...draftNote, text: e.target.value })}
                              placeholder="Write your comment on this specific point…"
                              rows={3}
                              autoFocus
                              className="text-sm"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setDraftNote(null)}>
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                type="submit"
                                disabled={!draftNote.text.trim()}
                              >
                                Save Comment
                              </Button>
                            </div>
                          </form>
                        ) : editText !== null ? (
                          <div className="flex flex-col gap-2">
                            <Textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows={3}
                              autoFocus
                              className="text-sm"
                            />
                            <div className="flex items-center justify-between gap-2">
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() =>
                                  run('note:delete', { id: activeNote.id }, () => setOpenId(null))
                                }
                              >
                                Delete
                              </Button>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setEditText(null)}>
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  disabled={!editText.trim()}
                                  onClick={() =>
                                    run(
                                      'note:update',
                                      { id: activeNote.id, text: editText.trim() },
                                      () => setEditText(null),
                                    )
                                  }
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <p className="text-sm whitespace-pre-wrap leading-relaxed text-ink">
                              {activeNote.text}
                            </p>
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-line/30 text-xs text-muted">
                              <span>
                                {activeNote.createdAt
                                  ? new Date(activeNote.createdAt).toLocaleTimeString([], {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                    })
                                  : ''}
                              </span>
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setEditText(activeNote.text)}>
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() =>
                                    run('note:delete', { id: activeNote.id }, () => setOpenId(null))
                                  }
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
                </div>
              )
            })}
          </Document>
        )}
      </div>
    </div>
  )
}
