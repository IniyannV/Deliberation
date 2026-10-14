import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Segmented, cx } from '../../../components/ui'
import { conflicts, generate } from './sudokuGenerator'

export default function Sudoku() {
  const [difficulty, setDifficulty] = useState('easy')
  const [game, setGame] = useState(() => generate('easy'))
  const [grid, setGrid] = useState(() => [...game.puzzle])
  const [sel, setSel] = useState(null)
  const [showErrors, setShowErrors] = useState(false)

  const newGame = useCallback((d = difficulty) => {
    const g = generate(d)
    setGame(g)
    setGrid([...g.puzzle])
    setSel(null)
    setShowErrors(false)
  }, [difficulty])

  const given = (i) => game.puzzle[i] !== 0
  const bad = useMemo(() => conflicts([...grid]), [grid])
  const solved = grid.every((v, i) => v === game.solution[i])
  const wrong = (i) => showErrors && grid[i] && !given(i) && grid[i] !== game.solution[i]

  const put = useCallback((v) => {
    if (sel === null || given(sel)) return
    setGrid((g) => g.map((x, i) => (i === sel ? v : x)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, game])

  useEffect(() => {
    const onKey = (e) => {
      if (sel === null) return
      if (/^[1-9]$/.test(e.key)) put(Number(e.key))
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') put(0)
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const d = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key]
        setSel((s) => Math.min(80, Math.max(0, s + d)))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel, put])

  const selVal = sel !== null ? grid[sel] : 0

  return (
    <div className="flex flex-wrap gap-8">
      <div className="grid aspect-square w-[min(34rem,calc(100vh-15rem))] grid-cols-9 grid-rows-9 overflow-hidden rounded-xl border-2 border-ink/60 bg-surface" role="grid" aria-label="Sudoku grid">
        {grid.map((v, i) => {
          const r = Math.floor(i / 9), c = i % 9
          const peer = sel !== null && (Math.floor(sel / 9) === r || sel % 9 === c || (Math.floor(sel / 27) === Math.floor(i / 27) && Math.floor((sel % 9) / 3) === Math.floor(c / 3)))
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSel(i)}
              aria-label={`Row ${r + 1}, column ${c + 1}${v ? `, ${v}` : ', empty'}${given(i) ? ', given' : ''}`}
              className={cx(
                'flex items-center justify-center border-line text-[min(1.8rem,4.5vh)] tabular-nums',
                c % 3 === 2 && c !== 8 ? 'border-r-2 border-r-ink/50' : c !== 8 && 'border-r',
                r % 3 === 2 && r !== 8 ? 'border-b-2 border-b-ink/50' : r !== 8 && 'border-b',
                sel === i ? 'bg-accent-soft' : peer ? 'bg-surface-2' : v && v === selVal ? 'bg-accent-soft/60' : '',
                given(i) ? 'font-bold text-ink' : 'text-accent',
                (wrong(i) || (bad.has(i) && !given(i))) && 'text-danger',
              )}
            >
              {v || ''}
            </button>
          )
        })}
      </div>

      <Card className="flex h-fit w-80 flex-col gap-5 p-5">
        {solved ? <p className="text-xl font-bold text-ok">Solved. Nicely done.</p> : <p className="text-muted">Select a square, then type or tap a number.</p>}
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <Button key={n} className="text-xl" onClick={() => put(n)}>{n}</Button>
          ))}
          <Button onClick={() => put(0)} aria-label="Clear square">⌫</Button>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showErrors} onChange={(e) => setShowErrors(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
          Show mistakes
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-muted">New puzzle</span>
          <Segmented label="Difficulty" value={difficulty} onChange={(d) => { setDifficulty(d); newGame(d) }} options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} />
          <Button icon="refresh" onClick={() => newGame()}>New {difficulty} puzzle</Button>
        </div>
      </Card>
    </div>
  )
}
