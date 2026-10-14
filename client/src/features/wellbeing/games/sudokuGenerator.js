// Local sudoku generator: fill a random solved grid, then remove cells while the solution stays unique.

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const canPlace = (g, i, v) => {
  const r = Math.floor(i / 9), c = i % 9
  for (let k = 0; k < 9; k++) {
    if (g[r * 9 + k] === v || g[k * 9 + c] === v) return false
  }
  const br = r - (r % 3), bc = c - (c % 3)
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (g[(br + y) * 9 + bc + x] === v) return false
  return true
}

function fill(g) {
  const i = g.indexOf(0)
  if (i === -1) return true
  for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (canPlace(g, i, v)) {
      g[i] = v
      if (fill(g)) return true
      g[i] = 0
    }
  }
  return false
}

/** Counts solutions up to `limit`, choosing the most constrained cell first. */
function countSolutions(g, limit = 2) {
  let best = -1, bestOpts = null
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue
    const opts = []
    for (let v = 1; v <= 9; v++) if (canPlace(g, i, v)) opts.push(v)
    if (!opts.length) return 0
    if (!bestOpts || opts.length < bestOpts.length) { best = i; bestOpts = opts }
    if (opts.length === 1) break
  }
  if (best === -1) return 1
  let n = 0
  for (const v of bestOpts) {
    g[best] = v
    n += countSolutions(g, limit - n)
    g[best] = 0
    if (n >= limit) break
  }
  return n
}

const CLUES = { easy: 40, medium: 32, hard: 26 }

export function generate(difficulty = 'easy') {
  const solution = Array(81).fill(0)
  fill(solution)
  const puzzle = [...solution]
  let filled = 81
  for (const i of shuffle([...Array(81).keys()])) {
    if (filled <= CLUES[difficulty]) break
    const keep = puzzle[i]
    puzzle[i] = 0
    if (countSolutions([...puzzle]) !== 1) puzzle[i] = keep
    else filled--
  }
  return { puzzle, solution }
}

export function conflicts(grid) {
  const bad = new Set()
  for (let i = 0; i < 81; i++) {
    const v = grid[i]
    if (!v) continue
    grid[i] = 0
    if (!canPlace(grid, i, v)) bad.add(i)
    grid[i] = v
  }
  return bad
}
