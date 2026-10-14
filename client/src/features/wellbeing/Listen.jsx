import { useEffect, useRef, useState } from 'react'
import { api, mediaUrl } from '../../lib/api'
import { fmtBytes } from '../../lib/format'
import { Badge, Card, EmptyState, ErrorText, cx } from '../../components/ui'
import { Icon } from '../../components/icons'

export default function Listen() {
  const [tracks, setTracks] = useState(null)
  const [current, setCurrent] = useState(null)
  const [error, setError] = useState('')
  const audio = useRef(null)

  useEffect(() => {
    api('/media').then(({ tracks }) => setTracks(tracks)).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (current && audio.current) audio.current.play().catch(() => {})
  }, [current])

  if (error) return <ErrorText>{error}</ErrorText>
  if (!tracks) return null
  if (!tracks.length) return <EmptyState icon="headphones" title="No audio loaded">The court can add licensed audiobooks and music to the server’s media folder.</EmptyState>

  const track = tracks.find((t) => t.file === current)

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_22rem]">
      <ul className="flex flex-col gap-2">
        {tracks.map((t) => (
          <li key={t.file}>
            <button
              type="button"
              onClick={() => setCurrent(t.file)}
              className={cx('flex w-full items-center gap-4 rounded-xl border p-4 text-left', current === t.file ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-muted')}
            >
              <span className="rounded-full bg-surface-2 p-2.5 text-muted"><Icon name={current === t.file ? 'volume' : 'play'} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{t.title}</span>
                <span className="text-sm text-muted">{[t.creator, fmtBytes(t.size)].filter(Boolean).join(' · ')}</span>
              </span>
              <Badge>{t.kind}</Badge>
            </button>
          </li>
        ))}
      </ul>
      <Card className="h-fit p-5 lg:sticky lg:top-0">
        <p className="text-sm text-muted">Now playing</p>
        <p className="mb-1 text-lg font-bold">{track?.title ?? 'Choose a track'}</p>
        {track?.description && <p className="mb-3 text-sm text-muted">{track.description}</p>}
        {/* Streams from the court laptop; supports seeking via HTTP range requests. */}
        <audio ref={audio} controls src={track ? mediaUrl(track.file) : undefined} className="mt-2 w-full" preload="none" />
      </Card>
    </div>
  )
}
