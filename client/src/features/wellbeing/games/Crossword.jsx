import { useEffect, useMemo, useRef, useState } from 'react'
import puzzle from '../../../data/crossword.json'
import { Button, Card, cx } from '../../../components/ui'

const key = (r, c) => `${r},${c}`

function buildGrid(p) {
  const cells = {}
  for (const e of p.entries) {
    for (let i = 0; i < e.answer.length; i++) {
      const r = e.row + (e.dir === 'down' ? i : 0)
      const c = e.col + (e.dir === 'across' ? i : 0)
      const cell = (cells[key(r, c)] ??= { r, c, answer: e.answer[i], entries: {} })
      cell.entries[e.dir] = e
      if (i === 0) cell.number = e.number
    }
  }
  return cells
}

export default function Crossword() {
  const cells = useMemo(() => buildGrid(puzzle), [])
  const [letters, setLetters] = useState({})
  const [pos, setPosState] = useState(() => {
    const first = puzzle.entries[0]
    return { r: first.row, c: first.col, dir: first.dir }
  })
  // Keystrokes can arrive faster than re-renders, so key handling reads the cursor from a ref.
  const posRef = useRef(pos)
  const setPos = (p) => {
    posRef.current = p
    setPosState(p)
  }
  const [checked, setChecked] = useState(false)
  const boardRef = useRef(null)

  const cell = cells[key(pos.r, pos.c)]
  const dir = cell?.entries[pos.dir] ? pos.dir : Object.keys(cell?.entries ?? { across: 1 })[0]
  const entry = cell?.entries[dir]
  const inEntry = (k) => {
    if (!entry) return false
    const [r, c] = k.split(',').map(Number)
    return entry.dir === 'across' ? r === entry.row && c >= entry.col && c < entry.col + entry.answer.length : c === entry.col && r >= entry.row && r < entry.row + entry.answer.length
  }

  const solved = Object.entries(cells).every(([k, v]) => letters[k] === v.answer)

  function select(r, c) {
    const k = key(r, c)
    if (!cells[k]) return
    if (r === pos.r && c === pos.c && Object.keys(cells[k].entries).length > 1) setPos({ r, c, dir: dir === 'across' ? 'down' : 'across' })
    else setPos({ r, c, dir: cells[k].entries[pos.dir] ? pos.dir : Object.keys(cells[k].entries)[0] })
    boardRef.current?.focus()
  }

  // The direction actually in use at a position (a cell may only run one way).
  const dirAt = (p) => (cells[key(p.r, p.c)]?.entries[p.dir] ? p.dir : Object.keys(cells[key(p.r, p.c)]?.entries ?? { across: 1 })[0])

  function step(delta) {
    const p = posRef.current
    const d = dirAt(p)
    const dr = d === 'down' ? delta : 0, dc = d === 'across' ? delta : 0
    if (cells[key(p.r + dr, p.c + dc)]) setPos({ r: p.r + dr, c: p.c + dc, dir: d })
  }

  function onKey(e) {
    const p = posRef.current
    const k = key(p.r, p.c)
    if (/^[a-z]$/i.test(e.key) && !e.metaKey && !e.ctrlKey) {
      setLetters((l) => ({ ...l, [k]: e.key.toUpperCase() }))
      setChecked(false)
      step(1)
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      if (letters[k]) setLetters((l) => ({ ...l, [k]: '' }))
      else step(-1)
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault()
      const d = { ArrowUp: [-1, 0, 'down'], ArrowDown: [1, 0, 'down'], ArrowLeft: [0, -1, 'across'], ArrowRight: [0, 1, 'across'] }[e.key]
      const nk = key(p.r + d[0], p.c + d[1])
      if (cells[nk]) setPos({ r: p.r + d[0], c: p.c + d[1], dir: cells[nk].entries[d[2]] ? d[2] : dirAt(p) })
    } else if (e.key === ' ' || e.key === 'Tab') {
      e.preventDefault()
      const list = puzzle.entries
      const current = cells[k]?.entries[dirAt(p)]
      const i = list.indexOf(current)
      const next = list[(i + (e.shiftKey ? list.length - 1 : 1)) % list.length]
      setPos({ r: next.row, c: next.col, dir: next.dir })
    }
  }

  useEffect(() => { boardRef.current?.focus() }, [])

  function reveal(e) {
    const add = {}
    for (let i = 0; i < e.answer.length; i++) add[key(e.row + (e.dir === 'down' ? i : 0), e.col + (e.dir === 'across' ? i : 0))] = e.answer[i]
    setLetters((l) => ({ ...l, ...add }))
  }

  const clueList = (d) => puzzle.entries.filter((e) => e.dir === d)

  return (
    <div className="flex flex-wrap gap-8">
      <div>
        <h2 className="mb-1 text-xl font-bold">{puzzle.title}</h2>
        <p className="mb-3 min-h-[3.5rem] max-w-[min(34rem,calc(100vh-15rem))] rounded-lg bg-accent-soft px-3 py-2 font-semibold text-accent">
          {entry ? `${entry.number} ${entry.dir}: ${entry.clue}` : ''}
        </p>
        <div
          ref={boardRef}
          tabIndex={0}
          onKeyDown={onKey}
          role="grid"
          aria-label="Crossword grid. Type letters; arrow keys move; space jumps to the next clue."
          className="grid aspect-square w-[min(34rem,calc(100vh-15rem))] gap-0.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{ gridTemplateColumns: `repeat(${puzzle.cols}, 1fr)`, gridTemplateRows: `repeat(${puzzle.rows}, 1fr)` }}
        >
          {Array.from({ length: puzzle.rows }, (_, r) =>
            Array.from({ length: puzzle.cols }, (_, c) => {
              const k = key(r, c)
              const cl = cells[k]
              if (!cl) return <div key={k} aria-hidden />
              const isCur = r === pos.r && c === pos.c
              const wrong = checked && letters[k] && letters[k] !== cl.answer
              return (
                <div
                  key={k}
                  onClick={() => select(r, c)}
                  className={cx('relative flex cursor-pointer items-center justify-center rounded-sm border border-line text-[min(1.6rem,4vh)] font-bold uppercase', isCur ? 'bg-warn-soft' : inEntry(k) ? 'bg-accent-soft' : 'bg-surface dark:bg-surface-2', wrong && 'text-danger')}
                >
                  {cl.number && <span className="absolute top-0.5 left-1 text-[0.55rem] leading-none font-normal text-muted">{cl.number}</span>}
                  {letters[k]}
                </div>
              )
            }),
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setChecked(true)}>Check puzzle</Button>
          <Button variant="ghost" onClick={() => entry && reveal(entry)}>Reveal this word</Button>
          <Button variant="ghost" onClick={() => { setLetters({}); setChecked(false) }}>Clear</Button>
        </div>
        {solved && <p className="mt-3 text-lg font-bold text-ok">Complete. Lovely work.</p>}
      </div>

      <Card className="grid h-fit gap-6 p-5 md:grid-cols-2">
        {['across', 'down'].map((d) => (
          <div key={d}>
            <h3 className="mb-2 font-bold capitalize">{d}</h3>
            <ol className="flex flex-col gap-1">
              {clueList(d).map((e) => (
                <li key={e.number + d}>
                  <button
                    type="button"
                    onClick={() => { setPos({ r: e.row, c: e.col, dir: d }); boardRef.current?.focus() }}
                    className={cx('w-full rounded-md px-2 py-1 text-left', entry === e ? 'bg-accent-soft font-semibold' : 'hover:bg-surface-2')}
                  >
                    <b className="mr-2">{e.number}</b>{e.clue}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </Card>
    </div>
  )
}
