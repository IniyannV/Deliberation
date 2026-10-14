import { useEffect, useState } from 'react'
import { Button, Segmented } from '../../components/ui'

const PATTERNS = {
  box: { label: 'Box breathing (4-4-4-4)', phases: [['Breathe in', 4, 1], ['Hold', 4, 1], ['Breathe out', 4, 0], ['Hold', 4, 0]] },
  '478': { label: '4-7-8 relaxing breath', phases: [['Breathe in', 4, 1], ['Hold', 7, 1], ['Breathe out', 8, 0]] },
}

/** A slow, animated guide. Each phase is [label, seconds, target scale (1 = full, 0 = small)]. */
export default function Breathe() {
  const [pattern, setPattern] = useState('box')
  const [running, setRunning] = useState(false)
  const [tick, setTick] = useState({ phase: 0, left: 0, cycles: 0 })
  const phases = PATTERNS[pattern].phases
  const { phase, left, cycles } = tick

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setTick((t) => {
        if (t.left > 1) return { ...t, left: t.left - 1 }
        const next = (t.phase + 1) % phases.length
        return { phase: next, left: phases[next][1], cycles: t.cycles + (next === 0 ? 1 : 0) }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running, phases])

  function start() {
    setTick({ phase: 0, left: phases[0][1], cycles: 0 })
    setRunning(true)
  }

  const [label, seconds, target] = phases[phase]
  const scale = running ? (target ? 1 : 0.45) : 0.6

  return (
    <div className="flex max-w-3xl flex-col items-center gap-8">
      <Segmented label="Breathing pattern" value={pattern} onChange={(p) => { setPattern(p); setRunning(false); setTick({ phase: 0, left: 0, cycles: 0 }) }} options={Object.entries(PATTERNS).map(([v, p]) => ({ value: v, label: p.label }))} />

      <div className="relative flex h-96 w-96 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-line" />
        <div
          className="absolute inset-0 rounded-full bg-accent-soft ring-1 ring-accent/30"
          style={{ transform: `scale(${scale})`, transition: `transform ${running ? seconds : 0.8}s ease-in-out` }}
        />
        <div className="relative text-center" aria-live="polite">
          <p className="text-3xl font-bold text-accent">{running ? label : 'Ready when you are'}</p>
          {running && <p className="mt-2 text-5xl font-bold tabular-nums text-ink/70">{left}</p>}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {running ? <Button size="lg" onClick={() => setRunning(false)}>Stop</Button> : <Button size="lg" variant="primary" onClick={start}>Begin</Button>}
        {cycles > 0 && <p className="text-muted">{cycles} cycle{cycles === 1 ? '' : 's'} completed</p>}
      </div>
      <p className="max-w-lg text-center text-muted">Breathe through your nose, let your shoulders drop, and follow the circle. Stop any time you feel light-headed.</p>
    </div>
  )
}
