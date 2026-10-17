import { useRef, useState } from 'react'
import { IconButton, Segmented } from '../../components/ui'

const SPEEDS = [0.25, 0.5, 1, 1.5, 2]

/** Video exhibit: the system player (touch-friendly on iPad), plus skip and slow-motion controls. */
export default function VideoViewer({ url, title }) {
  const video = useRef(null)
  const [rate, setRate] = useState(1)

  const skip = (s) => {
    const v = video.current
    if (!v) return
    v.currentTime = Math.min(v.duration || 0, Math.max(0, v.currentTime + s))
  }
  const changeRate = (r) => {
    setRate(r)
    if (video.current) video.current.playbackRate = r
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-1.5">
        <div className="flex items-center gap-1">
          <IconButton icon="skipBack" label="Back 5 seconds" onClick={() => skip(-5)} />
          <IconButton icon="skipForward" label="Forward 5 seconds" onClick={() => skip(5)} />
        </div>
        <Segmented label="Playback speed" value={rate} onChange={changeRate} options={SPEEDS.map((v) => ({ value: v, label: `${v}×` }))} />
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
        <video
          ref={video}
          // A tiny start offset makes browsers (iPad Safari included) paint the first frame before play.
          src={`${url}#t=0.001`}
          controls
          playsInline
          preload="metadata"
          aria-label={title}
          onLoadedMetadata={(e) => { e.currentTarget.playbackRate = rate }}
          className="max-h-full max-w-full"
        />
      </div>
    </div>
  )
}
