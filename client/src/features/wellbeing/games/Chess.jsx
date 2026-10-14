import { useEffect, useMemo, useState } from 'react'
import { Chess as ChessGame } from 'chess.js'
import { Button, Card, Segmented, cx } from '../../../components/ui'
import { chooseMove } from './chessAi'

const GLYPH = { w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } }
const NAME = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }
const FILES = 'abcdefgh'

export default function Chess() {
  const [game] = useState(() => new ChessGame())
  const [, setVersion] = useState(0)
  const [selected, setSelected] = useState(null)
  const [playerColor, setPlayerColor] = useState('w')
  const [level, setLevel] = useState('normal')
  const [lastMove, setLastMove] = useState(null)
  const [thinking, setThinking] = useState(false)
  const refresh = () => setVersion((v) => v + 1)

  const aiTurn = game.turn() !== playerColor && !game.isGameOver()

  useEffect(() => {
    if (!aiTurn) return
    setThinking(true)
    const id = setTimeout(() => {
      const m = chooseMove(game, level)
      if (m) {
        game.move(m)
        setLastMove({ from: m.from, to: m.to })
      }
      setThinking(false)
      refresh()
    }, 350)
    return () => clearTimeout(id)
  }, [aiTurn, game, level])

  const targets = useMemo(
    () => (selected ? game.moves({ square: selected, verbose: true }).map((m) => m.to) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, game.fen()],
  )

  function clickSquare(sq) {
    if (aiTurn) return
    const piece = game.get(sq)
    if (selected && targets.includes(sq)) {
      game.move({ from: selected, to: sq, promotion: 'q' })
      setLastMove({ from: selected, to: sq })
      setSelected(null)
      refresh()
      return
    }
    setSelected(piece && piece.color === playerColor ? sq : null)
  }

  function newGame(color = playerColor) {
    game.reset()
    setPlayerColor(color)
    setSelected(null)
    setLastMove(null)
    refresh()
  }

  function undo() {
    game.undo()
    if (game.turn() !== playerColor) game.undo()
    setSelected(null)
    setLastMove(null)
    refresh()
  }

  let status = thinking ? 'Thinking…' : game.turn() === playerColor ? 'Your move' : ''
  if (game.isCheckmate()) status = game.turn() === playerColor ? 'Checkmate. Well played by the computer.' : 'Checkmate. You win!'
  else if (game.isStalemate()) status = 'Stalemate: a draw.'
  else if (game.isDraw()) status = 'Draw.'
  else if (game.inCheck()) status += ' (check)'

  const rows = playerColor === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  const files = playerColor === 'w' ? FILES.split('') : FILES.split('').reverse()

  return (
    <div className="flex flex-wrap gap-8">
      <div className="grid aspect-square w-[min(36rem,calc(100vh-15rem))] grid-cols-8 grid-rows-8 overflow-hidden rounded-xl border border-line select-none" role="grid" aria-label="Chess board">
        {rows.map((rank) =>
          files.map((file) => {
            const sq = `${file}${rank}`
            const piece = game.get(sq)
            const dark = (FILES.indexOf(file) + rank) % 2 === 0
            const isTarget = targets.includes(sq)
            return (
              <button
                key={sq}
                type="button"
                onClick={() => clickSquare(sq)}
                aria-label={`${sq}${piece ? `, ${piece.color === 'w' ? 'white' : 'black'} ${NAME[piece.type]}` : ''}`}
                className={cx(
                  'relative flex items-center justify-center text-[min(3.2rem,7vh)] leading-none',
                  dark ? 'bg-[#b7c4bf] dark:bg-[#4b5a56]' : 'bg-[#eef0e9] dark:bg-[#7d8a85]',
                  (lastMove?.from === sq || lastMove?.to === sq) && 'after:absolute after:inset-0 after:bg-warn/25',
                  selected === sq && 'after:absolute after:inset-0 after:bg-accent/35',
                )}
              >
                {piece && <span className={piece.color === 'w' ? 'text-white [text-shadow:0_0_2px_#222,0_0_1px_#222]' : 'text-[#1d2321]'}>{GLYPH[piece.color][piece.type]}</span>}
                {isTarget && <span className={cx('absolute rounded-full bg-accent/50', piece ? 'inset-1 bg-transparent ring-4 ring-accent/50' : 'h-4 w-4')} />}
              </button>
            )
          }),
        )}
      </div>

      <Card className="flex h-fit w-80 flex-col gap-5 p-5">
        <p className="text-xl font-bold" aria-live="polite">{status}</p>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-muted">Opponent</span>
          <Segmented label="Opponent strength" value={level} onChange={setLevel} options={[{ value: 'random', label: 'Relaxed' }, { value: 'easy', label: 'Easy' }, { value: 'normal', label: 'Normal' }]} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => newGame('w')}>New game as white</Button>
          <Button onClick={() => newGame('b')}>New game as black</Button>
          <Button icon="undo" variant="ghost" disabled={game.history().length < 1 || thinking} onClick={undo}>Take back</Button>
        </div>
        <p className="text-sm text-muted">Click a piece, then a highlighted square. Pawns promote to queens.</p>
      </Card>
    </div>
  )
}
