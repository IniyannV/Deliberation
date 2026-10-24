import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { fileProblem } from '../../lib/api'
import { useLongPress } from '../../lib/touch'
import { IconButton } from '../../components/ui'
import { Icon } from '../../components/icons'
import { PDF_OPTIONS } from './pdfSetup'
import { clamp01 } from './NoteCard'
import { AnnotationHint, AnnotationLayer, AnnotationTools, AnnotationsToggle, useAnnotator } from './annotations'

export default function PdfViewer({ exhibit, url, title }) {
  const box = useRef(null)
  const pageRefs = useRef({})

  const [width, setWidth] = useState(600)
  const [pages, setPages] = useState(0)
  const [activePage, setActivePage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState('')

  // Floating text selection action bar
  const [textSelection, setTextSelection] = useState(null) // { page, text, x, y, w, h, clientTop, clientLeft }

  const a = useAnnotator({
    exhibitId: exhibit?.id,
    surfaceFor: (p) => pageRefs.current[p],
    onToolChange: () => setTextSelection(null),
  })
  const { tool } = a

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
    const pageNum = Number(e.currentTarget?.dataset?.pageNumber) || activePage
    setTextSelection(null)
    a.startNoteAt(pageNum, clientX, clientY)
  })

  return (
    <div className="@container flex h-full min-h-0 flex-col">
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

          <AnnotationsToggle a={a} />
        </div>

        {/* Center: Tool Picker & Color Swatches */}
        <AnnotationTools a={a} />

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
              a.startNote(page, x, y, text.slice(0, 300))
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
              a.setShowAnnotations(true)
              await a.run('note:create', {
                exhibitId: exhibit?.id,
                page,
                kind: 'highlight',
                color: a.color,
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

      {/* Mode hint banner for Point Comment and Eraser modes */}
      <AnnotationHint a={a} />

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

                  <AnnotationLayer a={a} page={pageNum} paged />
                </div>
              )
            })}
          </Document>
        )}
      </div>
    </div>
  )
}
