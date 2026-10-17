import { useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { IconButton } from '../../components/ui'
import { PDF_OPTIONS } from './pdfSetup'

export default function PdfViewer({ url, title }) {
  const box = useRef(null)
  const [width, setWidth] = useState(600)
  const [pages, setPages] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width - 32)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const file = useMemo(() => ({ url }), [url])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5 text-sm text-muted">
        <span>{pages ? `${pages} page${pages === 1 ? '' : 's'}` : ' '}</span>
        <div className="flex items-center gap-1">
          <IconButton icon="minus" label="Zoom out" size={16} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} />
          <span className="w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <IconButton icon="plus" label="Zoom in" size={16} onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} />
        </div>
      </div>
      <div ref={box} className="min-h-0 flex-1 overflow-auto bg-surface-2 p-4 scrollbar-thin" aria-label={title}>
        {error ? (
          <p className="text-danger">{error}</p>
        ) : (
          // Without suspense={false}, react-pdf throws a failed load past onLoadError and blanks the app.
          <Document
            file={file}
            options={PDF_OPTIONS}
            suspense={false}
            onLoadSuccess={({ numPages }) => setPages(numPages)}
            onLoadError={(e) => setError(`Could not open this PDF (${e.message}).`)}
            loading={<p className="text-muted">Opening document…</p>}
          >
            {Array.from({ length: pages }, (_, i) => (
              <Page key={i} pageNumber={i + 1} width={width * zoom} suspense={false} loading="" />
            ))}
          </Document>
        )}
      </div>
    </div>
  )
}
