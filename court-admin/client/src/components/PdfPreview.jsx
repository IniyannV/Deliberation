import { useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
// The worker is bundled by Vite and served from this server, never a CDN.
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { Spinner } from './ui'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

// Character maps, standard fonts and decoders are copied into /public/pdfjs at build time.
const OPTIONS = {
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  wasmUrl: '/pdfjs/wasm/',
  isEvalSupported: false,
  withCredentials: true,
}

/**
 * Every page of a PDF, drawn with pdf.js as the jury app draws it, so the
 * clerk previews exactly what jurors will see. (A browser's own PDF viewer
 * isn't dependable inside a dialog.)
 */
export default function PdfPreview({ url }) {
  const box = useRef(null)
  const [state, setState] = useState({ pages: 0, error: '' })

  useEffect(() => {
    let cancelled = false
    const task = pdfjs.getDocument({ url, ...OPTIONS })
    const host = box.current
    host.replaceChildren()
    task.promise.then(async (doc) => {
      if (cancelled) return
      setState({ pages: doc.numPages, error: '' })
      const width = host.clientWidth
      for (let n = 1; n <= doc.numPages && !cancelled; n++) {
        const page = await doc.getPage(n)
        const scale = width / page.getViewport({ scale: 1 }).width
        const viewport = page.getViewport({ scale: scale * window.devicePixelRatio })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = '100%'
        canvas.className = 'rounded-lg bg-white shadow-card'
        canvas.setAttribute('aria-label', `Page ${n}`)
        host.append(canvas)
        await page.render({ canvas, viewport }).promise
      }
    }).catch((err) => !cancelled && setState({ pages: 0, error: err.message || 'This PDF could not be shown.' }))
    return () => { cancelled = true; task.destroy() }
  }, [url])

  return (
    <div>
      {!state.pages && !state.error && <Spinner label="Opening the PDF…" />}
      {state.error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-danger">{state.error}</p>}
      <div ref={box} className="flex flex-col gap-4" />
    </div>
  )
}
