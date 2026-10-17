import { pdfjs } from 'react-pdf'
// The worker is bundled by Vite and served from this server, never a CDN.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

// Character maps, standard fonts and decoders are copied into /public/pdfjs at build time.
export const PDF_OPTIONS = {
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  wasmUrl: '/pdfjs/wasm/',
  isEvalSupported: false,
  withCredentials: true,
}
