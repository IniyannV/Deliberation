import { useMemo, useState } from 'react'
import { Document, Page } from 'react-pdf'
import { PDF_OPTIONS } from './pdfSetup'

/** A static picture of a PDF's first page, for the exhibit locker. */
export default function PdfThumb({ url, width, fallback }) {
  const file = useMemo(() => ({ url }), [url])
  const [failed, setFailed] = useState(false)
  if (failed) return fallback
  // suspense={false}: react-pdf's default Suspense mode throws load errors to the
  // nearest error boundary, so one missing file would blank the whole app.
  return (
    <Document file={file} options={PDF_OPTIONS} suspense={false} loading={fallback} error={fallback} onLoadError={() => setFailed(true)}>
      <Page pageNumber={1} width={width} suspense={false} renderTextLayer={false} renderAnnotationLayer={false} loading="" error={fallback} />
    </Document>
  )
}
