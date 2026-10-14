import { Suspense, lazy, useState } from 'react'
import { exhibitFileUrl } from '../../lib/api'
import { Segmented, Spinner } from '../../components/ui'
import { useLive } from '../../store/live'
import { useExhibit } from './useExhibit'
import TranscriptView from './TranscriptView'

const PdfViewer = lazy(() => import('./PdfViewer'))

function ImageViewer({ url, title }) {
  const [mode, setMode] = useState('fit')
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex justify-end border-b border-line px-3 py-1.5">
        <Segmented label="Image size" value={mode} onChange={setMode} options={[{ value: 'fit', label: 'Fit' }, { value: 'full', label: 'Actual size' }]} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-surface-2 p-4 scrollbar-thin">
        <img src={url} alt={title} className={mode === 'fit' ? 'mx-auto max-h-full max-w-full object-contain' : 'max-w-none'} />
      </div>
    </div>
  )
}

/** Renders any exhibit type in a full-height panel. */
export default function ExhibitViewer({ exhibitId, focusLine, onOpenExhibit }) {
  const { exhibit, error } = useExhibit(exhibitId)
  const links = useLive((s) => s.links)
  const exhibits = useLive((s) => s.exhibits)
  if (error) return <p className="p-6 text-danger">{error}</p>
  if (!exhibit) return <Spinner label="Opening exhibit…" />
  const title = `${exhibit.number}: ${exhibit.title}`
  if (exhibit.type === 'pdf') return <Suspense fallback={<Spinner />}><PdfViewer url={exhibitFileUrl(exhibit.id)} title={title} /></Suspense>
  if (exhibit.type === 'image') return <ImageViewer url={exhibitFileUrl(exhibit.id)} title={title} />
  return (
    <div className="h-full overflow-y-auto p-4 scrollbar-thin">
      <TranscriptView
        exhibit={exhibit}
        links={links}
        exhibitsById={Object.fromEntries(exhibits.map((e) => [e.id, e]))}
        onOpenExhibit={onOpenExhibit}
        focusLine={focusLine}
      />
    </div>
  )
}
