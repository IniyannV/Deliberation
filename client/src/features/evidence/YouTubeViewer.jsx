import { useEffect, useRef, useState } from 'react'
import { IconButton, Segmented, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import { SPEEDS, StepButton, fmtClock, usePlayerKeys } from './VideoViewer'

// YouTube doesn't say a video's frame rate; most are 30 (or 25/24, where a step may repeat a frame).
const STEP = 1 / 30
const ORIGIN = 'https://www.youtube-nocookie.com'

/**
 * A YouTube exhibit in YouTube's privacy-enhanced player. It is driven with
 * the embed's postMessage protocol rather than YouTube's script, so the app
 * still loads no code from the internet; only the framed player does, and
 * only on a device that can reach it.
 */
export default function YouTubeViewer({ videoId, title }) {
  const frame = useRef(null)
  const owner = useRef({})
  const [state, setState] = useState({ playing: false, time: 0, duration: 0, ready: false })
  const [rate, setRate] = useState(1)
  // The player reports its time a few times a second; between reports, extrapolate for stepping.
  const clock = useRef({ time: 0, at: 0, playing: false })

  const send = (func, args = []) =>
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), ORIGIN)

  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== ORIGIN || e.source !== frame.current?.contentWindow) return
      let msg
      try { msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data } catch { return }
      if (msg?.event === 'onReady') setState((s) => ({ ...s, ready: true }))
      const info = msg?.info
      if (msg?.event !== 'infoDelivery' || !info || typeof info !== 'object') return
      setState((s) => {
        const next = { ...s, ready: true }
        if (typeof info.currentTime === 'number') next.time = info.currentTime
        if (typeof info.duration === 'number' && info.duration > 0) next.duration = info.duration
        if (typeof info.playerState === 'number') next.playing = info.playerState === 1
        clock.current = { time: next.time, at: performance.now(), playing: next.playing }
        return next
      })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Ask the player to report its state, repeating (as YouTube's own script does) until it answers.
  const listen = () => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: videoId, channel: 'widget' }), ORIGIN)
  useEffect(() => {
    if (state.ready) return
    const id = setInterval(listen, 300)
    const stop = setTimeout(() => clearInterval(id), 15000)
    return () => { clearInterval(id); clearTimeout(stop) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ready])

  const now = () => {
    const c = clock.current
    return c.playing ? c.time + ((performance.now() - c.at) / 1000) * rate : c.time
  }
  const seek = (t) => {
    const to = Math.max(0, state.duration ? Math.min(state.duration, t) : t)
    clock.current = { ...clock.current, time: to, at: performance.now() }
    setState((s) => ({ ...s, time: to }))
    send('seekTo', [to, true])
  }
  const play = () => send('playVideo')
  const pause = () => { clock.current = { ...clock.current, time: now(), playing: false }; send('pauseVideo') }
  const toggle = () => (state.playing ? pause() : play())
  const step = (dir, unit = 'frame') => {
    const t = now()
    pause()
    seek(t + dir * (unit === 'second' ? 1 : STEP))
  }
  const changeRate = (r) => { setRate(r); send('setPlaybackRate', [r]) }

  const keys = usePlayerKeys(owner.current, { step, toggle })

  const src = `${ORIGIN}/embed/${encodeURIComponent(videoId)}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(window.location.origin)}`

  return (
    <div className="flex h-full min-h-0 flex-col" {...keys}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-1.5">
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <Icon name="alert" size={16} /> Streams from YouTube; needs an internet connection
        </p>
        <Segmented label="Playback speed" value={rate} onChange={changeRate} options={SPEEDS.map((v) => ({ value: v, label: `${v}×` }))} />
      </div>
      <div className="relative min-h-0 flex-1 bg-black">
        <iframe
          ref={frame}
          src={src}
          title={title}
          onLoad={listen}
          // YouTube refuses embeds that arrive without a referrer; the app's own policy is no-referrer.
          referrerPolicy="strict-origin-when-cross-origin"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line px-2 py-1.5">
        <div className="flex items-center">
          <IconButton icon="skipBack" label="Back 5 seconds" onClick={() => seek(now() - 5)} disabled={!state.ready} />
          <StepButton dir={-1} onClick={() => step(-1)} />
          <button
            type="button"
            onClick={toggle}
            disabled={!state.ready}
            aria-label={state.playing ? 'Pause' : 'Play'}
            className="pressable mx-1 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-ink disabled:opacity-40"
          >
            <Icon name={state.playing ? 'pause' : 'play'} size={20} strokeWidth={0} className={cx('fill-current', !state.playing && 'ml-0.5')} />
          </button>
          <StepButton dir={1} onClick={() => step(1)} />
          <IconButton icon="skipForward" label="Forward 5 seconds" onClick={() => seek(now() + 5)} disabled={!state.ready} />
        </div>
        <input
          type="range"
          min={0}
          max={state.duration || 0}
          step={STEP}
          value={Math.min(state.time, state.duration || 0)}
          onChange={(e) => { pause(); seek(Number(e.target.value)) }}
          disabled={!state.ready}
          aria-label="Position"
          aria-valuetext={`${fmtClock(state.time)} of ${fmtClock(state.duration)}`}
          className="scrubber min-w-32 flex-1"
        />
        <span className="px-1 text-sm text-muted tabular-nums">{fmtClock(state.time)} / {fmtClock(state.duration)}</span>
      </div>
    </div>
  )
}
