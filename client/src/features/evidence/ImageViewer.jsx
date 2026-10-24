import { useEffect, useRef, useState } from 'react'
import { fileProblem } from '../../lib/api'
import { useLongPress } from '../../lib/touch'
import { Segmented, cx } from '../../components/ui'
import { AnnotationHint, AnnotationLayer, AnnotationTools, AnnotationsToggle, useAnnotator } from './annotations'

export default function ImageViewer({ exhibit, url, title }) {
  const [mode, setMode] = useState('fit')
  const box = useRef(null)
  const surface = useRef(null)
  const [boxH, setBoxH] = useState(600)
  const [error, setError] = useState('')

  // An image is a single page: every annotation sits on page 1 of the wrapper around it
  const a = useAnnotator({ exhibitId: exhibit.id, surfaceFor: () => surface.current })

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setBoxH(e.contentRect.height))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])

  // Right-click or long-press the image drops a point comment
  const pinMenu = useLongPress((clientX, clientY) => a.startNoteAt(1, clientX, clientY))

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line bg-surface/85 px-3 py-2 text-sm backdrop-blur-md">
        <AnnotationsToggle a={a} />
        <AnnotationTools a={a} navigateLabel="View" />
        <Segmented label="Image size" value={mode} onChange={setMode} options={[{ value: 'fit', label: 'Fit' }, { value: 'full', label: 'Actual size' }]} />
      </div>
      <AnnotationHint a={a} surface="image" />
      <div ref={box} className="min-h-0 flex-1 overflow-auto bg-surface-2 p-4 text-center scrollbar-thin">
        {error && <p className="py-8 text-danger">{error}</p>}
        <div ref={surface} {...pinMenu} className={cx('relative inline-block align-top', error && 'hidden')}>
          <img
            src={url}
            alt={title}
            className={cx('no-callout block', mode === 'fit' ? 'max-w-full' : 'max-w-none')}
            style={mode === 'fit' ? { maxHeight: Math.max(200, boxH - 32) } : undefined}
            draggable={false}
            onError={async () => setError((await fileProblem(url)) ?? 'Could not open this image.')}
          />
          <AnnotationLayer a={a} page={1} />
        </div>
      </div>
    </div>
  )
}
