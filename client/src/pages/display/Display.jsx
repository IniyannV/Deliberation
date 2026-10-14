import { useEffect, useState } from 'react'
import { useAuth } from '../../store/auth'
import { useLive } from '../../store/live'
import { useUi } from '../../store/ui'
import { Icon } from '../../components/icons'
import Timeline from '../../features/timeline/Timeline'
import ResultsBars, { VoteProgress } from '../../features/voting/ResultsBars'

/** Read-only projector view. The foreperson chooses what it shows. */

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(id)
  }, [])
  return <span className="tabular-nums">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
}

function VotesView({ votes, counts, voteId }) {
  const latest = [...votes].filter((v) => v.status !== 'voided').sort((a, b) => (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt))
  const vote = votes.find((v) => v.id === voteId) ?? votes.find((v) => v.status === 'open') ?? latest[0]
  if (!vote) return <p className="text-3xl text-muted">No polls or ballots yet.</p>
  const title = vote.kind === 'ballot' ? counts.find((c) => c.id === vote.countId)?.label ?? vote.question : vote.question
  return (
    <div className="mx-auto w-full max-w-5xl">
      <p className="mb-2 text-2xl font-semibold text-muted">{vote.kind === 'ballot' ? 'Secret ballot' : 'Temperature poll'}</p>
      <h2 className="mb-12 text-5xl leading-tight font-bold">{title}</h2>
      {vote.status === 'open' ? (
        <div>
          <VoteProgress vote={vote} large />
          <p className="mt-8 text-2xl text-muted">Results appear here once {vote.kind === 'ballot' ? 'every juror has voted' : 'everyone has voted or the foreperson closes the poll'}.</p>
        </div>
      ) : vote.status === 'voided' ? (
        <p className="text-3xl text-muted">This ballot was voided. No result was recorded.</p>
      ) : (
        <ResultsBars vote={vote} large />
      )}
    </div>
  )
}

function CalmView() {
  const [inhale, setInhale] = useState(true)
  useEffect(() => {
    const id = setInterval(() => setInhale((v) => !v), 6000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex flex-col items-center gap-14">
      <div className="relative h-[22rem] w-[22rem]">
        <div className="absolute inset-0 rounded-full bg-accent-soft transition-transform duration-[6000ms] ease-in-out" style={{ transform: `scale(${inhale ? 1 : 0.55})` }} />
      </div>
      <p className="text-4xl font-semibold text-muted">{inhale ? 'Breathe in…' : 'Breathe out…'}</p>
    </div>
  )
}

export default function Display() {
  const caseInfo = useAuth((s) => s.caseInfo)
  const logout = useAuth((s) => s.logout)
  const { connected, display, timeline, votes, counts } = useLive()
  const { theme, toggleTheme } = useUi()

  return (
    <div className="flex h-screen flex-col bg-bg">
      <header className="group flex items-center justify-between border-b border-line px-10 py-5 text-xl">
        <div>
          <span className="font-bold">{caseInfo?.caption}</span>
          <span className="ml-4 text-muted">Jury deliberation room</span>
        </div>
        <div className="flex items-center gap-6 text-muted">
          {!connected && <span className="text-warn">Reconnecting…</span>}
          <Clock />
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button type="button" className="rounded-lg p-2 hover:bg-surface-2" onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Full screen"><Icon name="maximize" /></button>
            <button type="button" className="rounded-lg p-2 hover:bg-surface-2" onClick={toggleTheme} aria-label="Toggle dark mode"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
            <button type="button" className="rounded-lg p-2 hover:bg-surface-2" onClick={logout} aria-label="Sign out"><Icon name="logout" /></button>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-10 py-8 scrollbar-thin">
        {display.view === 'timeline' && (
          timeline.length
            ? <div><h1 className="mb-4 text-3xl font-bold">Timeline</h1><Timeline events={timeline} zoom="fit" /></div>
            : <p className="my-auto text-center text-3xl text-muted">The jury’s timeline will appear here.</p>
        )}
        {display.view === 'votes' && <div className="my-auto"><VotesView votes={votes} counts={counts} voteId={display.voteId} /></div>}
        {display.view === 'calm' && <div className="my-auto"><CalmView /></div>}
      </main>
    </div>
  )
}
