import { cx } from '../../components/ui'

const BAR_COLORS = ['bg-testimony', 'bg-physical', 'bg-document', 'bg-accent', 'bg-warn', 'bg-muted']

/** Horizontal bar chart of a closed vote. Counts are always shown as text, too. */
export default function ResultsBars({ vote, large = false }) {
  const total = Object.values(vote.tally ?? {}).reduce((a, b) => a + b, 0)
  return (
    <ul className={cx('flex flex-col', large ? 'gap-6' : 'gap-3')}>
      {vote.options.map((o, i) => {
        const n = vote.tally?.[o.id] ?? 0
        const pct = total ? (n / total) * 100 : 0
        return (
          <li key={o.id}>
            <div className={cx('mb-1 flex justify-between font-semibold', large && 'text-3xl')}>
              <span>{o.label}</span>
              <span className="tabular-nums">{n}</span>
            </div>
            <div className={cx('overflow-hidden rounded-full bg-fill', large ? 'h-10' : 'h-4')} role="img" aria-label={`${o.label}: ${n} of ${total}`}>
              <div className={cx('h-full rounded-full transition-[width] duration-700 ease-[var(--ease-fluid)]', BAR_COLORS[i % BAR_COLORS.length])} style={{ width: `${pct}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

const OUTCOME = { guilty: 'Unanimous: Guilty', not_guilty: 'Unanimous: Not Guilty', not_unanimous: 'Not unanimous' }

/**
 * A closed vote's result. Counts are kept only in the court server's memory,
 * so after a restart a ballot shows just whether it was unanimous, and a poll
 * shows nothing.
 */
export function VoteResult({ vote, large = false }) {
  const outcome = vote.kind === 'ballot' && OUTCOME[vote.outcome]
  return (
    <div className={cx('flex flex-col', large ? 'gap-8' : 'gap-3')}>
      {outcome && <p className={cx('font-bold', large ? 'text-4xl' : 'text-lg', vote.outcome === 'not_unanimous' ? 'text-warn' : 'text-accent')}>{outcome}</p>}
      {vote.tally ? (
        <ResultsBars vote={vote} large={large} />
      ) : (
        <p className={cx('text-muted', large && 'text-2xl')}>
          {vote.kind === 'ballot' ? 'The counts were cleared when the court server restarted.' : 'The results were cleared when the court server restarted.'} Counts are never saved, so court staff can’t see how the jury was divided.
        </p>
      )}
    </div>
  )
}

export function VoteProgress({ vote, large = false }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" aria-hidden>
        {Array.from({ length: vote.eligible }, (_, i) => (
          <span key={i} className={cx('rounded-full', large ? 'h-8 w-8' : 'h-3.5 w-3.5', i < vote.votesCast ? 'bg-accent' : 'bg-fill-strong')} />
        ))}
      </div>
      <p className={cx('text-muted', large && 'text-3xl')}>
        {vote.votesCast} of {vote.eligible} jurors have voted
      </p>
    </div>
  )
}
