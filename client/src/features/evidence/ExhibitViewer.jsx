import { Suspense, lazy } from 'react'
import { exhibitFileUrl } from '../../lib/api'
import { Spinner } from '../../components/ui'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { useExhibit } from './useExhibit'
import TranscriptView from './TranscriptView'
import ImageViewer from './ImageViewer'

const PdfViewer = lazy(() => import('./PdfViewer'))
const MapViewer = lazy(() => import('./MapViewer'))
const ChartViewer = lazy(() => import('./ChartViewer'))

/** Renders any exhibit type in a full-height panel. */
export default function ExhibitViewer({ exhibitId, focusLine, onOpenExhibit }) {
  const { exhibit, error } = useExhibit(exhibitId)
  const links = useLive((s) => s.links)
  const exhibits = useLive((s) => s.exhibits)
  if (error) return <p className="p-6 text-danger">{error}</p>
  if (!exhibit) return <Spinner label="Opening exhibit…" />
  const title = `${exhibit.number}: ${exhibit.title}`

  // Interactive exhibits refer to other exhibits by number ("P-2").
  const openByNumber = (n) => {
    const target = exhibits.find((e) => e.number.toLowerCase() === n.toLowerCase())
    if (target) onOpenExhibit?.(target.id)
    else toast(`Exhibit ${n} isn't in the locker.`, { tone: 'warn' })
  }

  const lazyView = (node) => <Suspense fallback={<Spinner />}>{node}</Suspense>
  if (exhibit.type === 'pdf') return lazyView(<PdfViewer url={exhibitFileUrl(exhibit.id)} title={title} />)
  if (exhibit.type === 'image') return <ImageViewer exhibit={exhibit} url={exhibitFileUrl(exhibit.id)} title={title} />
  if (exhibit.type === 'map') return lazyView(<MapViewer spec={exhibit.spec} onOpenExhibitNumber={openByNumber} />)
  if (exhibit.type === 'chart') return lazyView(<ChartViewer spec={exhibit.spec} />)
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
