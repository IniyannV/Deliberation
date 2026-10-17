import { useEffect, useRef, useState } from 'react'
import { IconButton, Segmented, cx } from '../../components/ui'
import { Icon } from '../../components/icons'

export const SPEEDS = [0.25, 0.5, 1, 1.5, 2]
const FALLBACK_FPS = 30

/** m:ss.cc, so single frames are visibly different times. */
export function fmtClock(s) {
  if (!Number.isFinite(s)) return '0:00.00'
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${m}:${sec.toFixed(2).padStart(5, '0')}`
}

// With two players on screen (side-by-side review) the arrow keys drive the one last touched.
let activePlayer = null

/**
 * Arrow keys step frames, Shift+arrows a second, Space/K plays and pauses.
 * Keys typed into fields, and Space on a focused button, are left alone.
 */
export function usePlayerKeys(owner, { step, toggle }) {
  const latest = useRef({ step, toggle })
  latest.current = { step, toggle }
  useEffect(() => {
    activePlayer = owner
    const key = (e) => {
      if (activePlayer !== owner || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      const t = e.target
      const typing = t.closest?.('textarea, select, [contenteditable="true"], input:not([type="range"])')
      if (typing || document.querySelector('dialog[open]')) return // a field, or a popup is up
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ',' || e.key === '.') {
        e.preventDefault()
        const dir = e.key === 'ArrowLeft' || e.key === ',' ? -1 : 1
        latest.current.step(dir, e.shiftKey && e.key.startsWith('Arrow') ? 'second' : 'frame')
      } else if ((e.key === ' ' && !t.closest?.('button, [role="radio"], a')) || e.key === 'k') {
        e.preventDefault()
        latest.current.toggle()
      }
    }
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('keydown', key)
      if (activePlayer === owner) activePlayer = null
    }
  }, [owner])
  return {
    onPointerDownCapture: () => { activePlayer = owner },
    onFocusCapture: () => { activePlayer = owner },
  }
}

/**
 * Video exhibit with its own controls: play, a scrubber, frame-by-frame
 * stepping (buttons or arrow keys), 5-second skips and slow motion.
 * `fps` comes from the server's read of the file header; without it, steps
 * are 1/30 s.
 */
export default function VideoViewer({ url, title, fps }) {
  const video = useRef(null)
  const owner = useRef({})
  const [rate, setRate] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  // The juror pressed play and hasn't paused since. Used to recover when the
  // browser pauses on its own right after starting (seen on iPad Safari).
  const wantPlay = useRef(false)
  const resumes = useRef(0)
  const frameRate = fps || FALLBACK_FPS

  const play = () => {
    const v = video.current
    if (!v) return
    wantPlay.current = true
    resumes.current = 0
    if (v.ended) v.currentTime = 0
    v.play().catch(() => { wantPlay.current = false })
  }
  const pause = () => {
    wantPlay.current = false
    video.current?.pause()
  }
  const toggle = () => (video.current?.paused ? play() : pause())

  const seek = (t) => {
    const v = video.current
    if (!v) return
    v.currentTime = Math.min(v.duration || 0, Math.max(0, t))
    setTime(v.currentTime)
  }

  /** One frame (or one second) back or forward. Pauses first, so the frame stays on screen. */
  const step = (dir, unit = 'frame') => {
    const v = video.current
    if (!v) return
    pause()
    if (unit === 'second') return seek(v.currentTime + dir)
    const last = Math.max(0, Math.ceil((v.duration || 0) * frameRate) - 1)
    const frame = Math.floor(v.currentTime * frameRate + 1e-3)
    const next = Math.min(last, Math.max(0, frame + dir))
    // Aim for the middle of the frame so rounding never lands on its neighbour.
    seek((next + 0.5) / frameRate)
  }

  const keys = usePlayerKeys(owner.current, { step, toggle })

  useEffect(() => {
    const v = video.current
    if (!v) return
    const onPause = () => {
      setPlaying(false)
      // An unasked-for pause within moments of starting: try again (twice at most).
      if (wantPlay.current && !v.ended && !v.seeking && document.visibilityState === 'visible' && resumes.current < 2) {
        resumes.current += 1
        v.play().catch(() => { wantPlay.current = false })
      } else {
        wantPlay.current = false
      }
    }
    const onPlaying = () => {
      setPlaying(true)
      // Playing steadily for a while: later pauses are real (end of clip, other app, etc.).
      setTimeout(() => { if (!v.paused) resumes.current = 2 }, 2000)
    }
    v.addEventListener('pause', onPause)
    v.addEventListener('playing', onPlaying)
    return () => {
      v.removeEventListener('pause', onPause)
      v.removeEventListener('playing', onPlaying)
    }
  }, [])

  const changeRate = (r) => {
    setRate(r)
    if (video.current) video.current.playbackRate = r
  }

  const frame = Math.floor(time * frameRate + 1e-3) + 1

  return (
    <div className="flex h-full min-h-0 flex-col" {...keys}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-1.5">
        <p className="hidden text-sm text-muted sm:block">
          <kbd className="font-sans font-semibold">←</kbd> <kbd className="font-sans font-semibold">→</kbd> step one frame · <kbd className="font-sans font-semibold">Space</kbd> play or pause
        </p>
        <Segmented label="Playback speed" value={rate} onChange={changeRate} options={SPEEDS.map((v) => ({ value: v, label: `${v}×` }))} />
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center bg-black" onClick={toggle}>
        <video
          ref={video}
          src={url}
          playsInline
          preload="metadata"
          disablePictureInPicture
          aria-label={title}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget
            v.playbackRate = rate
            setDuration(v.duration)
            // Show the first frame instead of black (iPad Safari paints nothing until a seek or play).
            if (v.paused && v.currentTime === 0) v.currentTime = 0.001
          }}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onSeeked={(e) => setTime(e.currentTarget.currentTime)}
          onEnded={() => { wantPlay.current = false; setPlaying(false) }}
          className="max-h-full max-w-full"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line px-2 py-1.5">
        <div className="flex items-center">
          <IconButton icon="skipBack" label="Back 5 seconds" onClick={() => seek(time - 5)} />
          <StepButton dir={-1} onClick={() => step(-1)} />
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'Pause' : 'Play'}
            className="pressable mx-1 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-ink"
          >
            <Icon name={playing ? 'pause' : 'play'} size={20} strokeWidth={0} className={cx('fill-current', !playing && 'ml-0.5')} />
          </button>
          <StepButton dir={1} onClick={() => step(1)} />
          <IconButton icon="skipForward" label="Forward 5 seconds" onClick={() => seek(time + 5)} />
        </div>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={1 / frameRate}
          value={Math.min(time, duration || 0)}
          onChange={(e) => { pause(); seek(Number(e.target.value)) }}
          aria-label="Position"
          aria-valuetext={`${fmtClock(time)} of ${fmtClock(duration)}`}
          className="scrubber min-w-32 flex-1"
        />
        <span className="px-1 text-sm text-muted tabular-nums">
          {fmtClock(time)} / {fmtClock(duration)} · <span title={fps ? `${fps} frames per second` : 'Frame rate unknown; steps are 1/30 s'}>frame {frame}</span>
        </span>
      </div>
    </div>
  )
}

/** ⏴| and |⏵: one frame back or forward. */
export function StepButton({ dir, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir < 0 ? 'Previous frame' : 'Next frame'}
      title={dir < 0 ? 'Previous frame (←)' : 'Next frame (→)'}
      className="pressable inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-fill hover:text-ink"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        {dir < 0
          ? <><rect x="4" y="5" width="2.5" height="14" rx="1" /><path d="M19 5.5v13a.8.8 0 0 1-1.2.7L8.6 12.7a.8.8 0 0 1 0-1.4l9.2-6.5a.8.8 0 0 1 1.2.7z" /></>
          : <><rect x="17.5" y="5" width="2.5" height="14" rx="1" /><path d="M5 5.5v13a.8.8 0 0 0 1.2.7l9.2-6.5a.8.8 0 0 0 0-1.4L6.2 4.8A.8.8 0 0 0 5 5.5z" /></>}
      </svg>
    </button>
  )
}
