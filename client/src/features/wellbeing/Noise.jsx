import { useEffect, useRef, useState } from 'react'
import { Button, Card, Segmented, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import { NoiseEngine } from './noiseEngine'

const KINDS = [
  { id: 'rain', label: 'Rain', text: 'Soft rainfall on a window' },
  { id: 'pink', label: 'Pink noise', text: 'Balanced, like a steady waterfall' },
  { id: 'brown', label: 'Brown noise', text: 'Deep and low, like distant surf' },
  { id: 'white', label: 'White noise', text: 'Bright, like a fan' },
]
const TIMERS = [0, 15, 30, 60, 90]

export default function Noise() {
  const engine = useRef(null)
  const [playing, setPlaying] = useState(null)
  const [volume, setVolume] = useState(0.5)
  const [timer, setTimer] = useState(0)
  const [endsAt, setEndsAt] = useState(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    engine.current = new NoiseEngine()
    return () => engine.current.close()
  }, [])

  // Sleep timer: fade out gently when time is up.
  useEffect(() => {
    if (!endsAt) return
    const id = setInterval(() => {
      setNow(Date.now())
      if (Date.now() >= endsAt) {
        engine.current.stop(8)
        setPlaying(null)
        setEndsAt(null)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  function play(kind) {
    if (playing === kind) {
      engine.current.stop()
      setPlaying(null)
      setEndsAt(null)
      return
    }
    engine.current.setVolume(volume)
    engine.current.play(kind)
    setPlaying(kind)
    if (timer) setEndsAt(Date.now() + timer * 60e3)
  }

  function chooseTimer(m) {
    setTimer(m)
    setEndsAt(playing && m ? Date.now() + m * 60e3 : null)
  }

  const remaining = endsAt ? Math.max(0, Math.round((endsAt - now) / 1000)) : 0

  return (
    <div className="max-w-4xl">
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => play(k.id)}
            aria-pressed={playing === k.id}
            className={cx('flex items-center gap-4 rounded-xl border p-5 text-left', playing === k.id ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-muted')}
          >
            <span className={cx('rounded-full p-3', playing === k.id ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted')}>
              <Icon name={playing === k.id ? 'pause' : 'play'} />
            </span>
            <span>
              <span className="block text-lg font-bold">{k.label}</span>
              <span className="text-muted">{k.text}</span>
            </span>
          </button>
        ))}
      </div>

      <Card className="flex flex-col gap-6 p-6">
        <label className="flex items-center gap-4">
          <Icon name="volume" className="text-muted" />
          <span className="w-20 font-semibold">Volume</span>
          <input
            type="range" min={0} max={1} step={0.01} value={volume}
            onChange={(e) => { const v = Number(e.target.value); setVolume(v); engine.current.setVolume(v) }}
            className="flex-1 accent-[var(--color-accent)]"
          />
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <Icon name="clock" className="text-muted" />
          <span className="w-20 font-semibold">Sleep timer</span>
          <Segmented label="Sleep timer" value={timer} onChange={chooseTimer} options={TIMERS.map((m) => ({ value: m, label: m ? `${m} min` : 'Off' }))} />
          {endsAt && <span className="text-muted tabular-nums">Fades out in {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>}
        </div>
        {playing && <Button className="self-start" icon="pause" onClick={() => play(playing)}>Stop</Button>}
      </Card>
    </div>
  )
}
