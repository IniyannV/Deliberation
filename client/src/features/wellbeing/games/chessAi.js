/*
 * A deliberately modest chess opponent: material + light positional
 * evaluation with alpha-beta minimax. Depth 1 is gentle, depth 2 is a
 * reasonable casual game, and "random" just picks any legal move.
 */

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }
// Small bonus for central squares (index 0..63, a8..h1).
const CENTER = Array.from({ length: 64 }, (_, i) => {
  const r = Math.floor(i / 8), c = i % 8
  return 12 - (Math.abs(3.5 - r) + Math.abs(3.5 - c)) * 3
})

function evaluate(game, color) {
  if (game.isCheckmate()) return game.turn() === color ? -100000 : 100000
  if (game.isDraw()) return 0
  let score = 0
  game.board().forEach((row, r) =>
    row.forEach((sq, c) => {
      if (!sq) return
      const v = VALUE[sq.type] + (sq.type === 'p' || sq.type === 'n' || sq.type === 'b' ? CENTER[r * 8 + c] : 0)
      score += sq.color === color ? v : -v
    }),
  )
  return score
}

// Captures first makes alpha-beta prune far more.
const ordered = (game) => game.moves({ verbose: true }).sort((a, b) => (b.captured ? VALUE[b.captured] : 0) - (a.captured ? VALUE[a.captured] : 0))

function search(game, depth, alpha, beta, maximizing, color) {
  if (depth === 0 || game.isGameOver()) return evaluate(game, color)
  for (const m of ordered(game)) {
    game.move(m)
    const score = search(game, depth - 1, alpha, beta, !maximizing, color)
    game.undo()
    if (maximizing) alpha = Math.max(alpha, score)
    else beta = Math.min(beta, score)
    if (beta <= alpha) break
  }
  return maximizing ? alpha : beta
}

export function chooseMove(game, level) {
  const moves = game.moves({ verbose: true })
  if (!moves.length) return null
  if (level === 'random') return moves[Math.floor(Math.random() * moves.length)]
  const depth = level === 'easy' ? 0 : 1 // plies searched after our candidate move
  const color = game.turn()
  let best = []
  let bestScore = -Infinity
  for (const m of ordered(game)) {
    game.move(m)
    const score = search(game, depth, -Infinity, Infinity, false, color)
    game.undo()
    if (score > bestScore) { bestScore = score; best = [m] } else if (score === bestScore) best.push(m)
  }
  return best[Math.floor(Math.random() * best.length)] // vary play between equal moves
}
