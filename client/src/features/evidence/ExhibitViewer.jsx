import { Suspense, lazy } from 'react'
import { exhibitFileUrl } from '../../lib/api'
import { Spinner } from '../../components/ui'
import { useLive } from '../../store/live'
import { useExhibit } from './useExhibit'
import TranscriptView from './TranscriptView'
import ImageViewer from './ImageViewer'
import VideoViewer from './VideoViewer'
import YouTubeViewer from './YouTubeViewer'

const PdfViewer = lazy(() => import('./PdfViewer'))

/** Renders any exhibit type in a full-height panel. */
export default function ExhibitViewer({ exhibitId, focusLine, onOpenExhibit }) {
  const { exhibit, error } = useExhibit(exhibitId)
  const links = useLive((s) => s.links)
  const exhibits = useLive((s) => s.exhibits)
  if (error) return <p className="p-6 text-danger">{error}</p>
  if (!exhibit) return <Spinner label="Opening exhibit…" />
  const title = `${exhibit.number}: ${exhibit.title}`

  if (exhibit.type === 'pdf') return <Suspense fallback={<Spinner />}><PdfViewer url={exhibitFileUrl(exhibit.id)} title={title} /></Suspense>
  if (exhibit.type === 'image') return <ImageViewer exhibit={exhibit} url={exhibitFileUrl(exhibit.id)} title={title} />
  if (exhibit.type === 'video') return <VideoViewer url={exhibitFileUrl(exhibit.id)} title={title} fps={exhibit.fps} />
  if (exhibit.type === 'youtube') return <YouTubeViewer videoId={exhibit.youtubeId} title={title} />
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
