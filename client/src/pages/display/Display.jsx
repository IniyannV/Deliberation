import { useEffect, useState } from 'react'
import { useAuth } from '../../store/auth'
import { useLive } from '../../store/live'
import { useUi } from '../../store/ui'
import { Icon } from '../../components/icons'
import { Card } from '../../components/ui'
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
      <p className="mb-3 text-2xl font-semibold text-accent">{vote.kind === 'ballot' ? 'Secret ballot' : 'Poll'}</p>
      <h2 className="mb-12 text-6xl leading-[1.05] font-bold tracking-tight">{title}</h2>
      {vote.status === 'open' && vote.kind === 'ballot' ? (
        // No running count for secret ballots (the server doesn't send one to the display).
        <p className="text-3xl text-muted">Voting is in progress. The result will appear here once every juror has voted.</p>
      ) : vote.status === 'open' ? (
        <div>
          <VoteProgress vote={vote} large />
          <p className="mt-8 text-2xl text-muted">Results appear here once everyone has voted or the foreperson closes the poll.</p>
        </div>
      ) : vote.status === 'voided' ? (
        <p className="text-3xl text-muted">This ballot was voided. No result was recorded.</p>
      ) : (
        <ResultsBars vote={vote} large />
      )}
    </div>
  )
}

function IdleView({ caseInfo }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="mb-8 flex h-28 w-28 items-center justify-center rounded-[1.75rem] bg-linear-to-b from-[#3b8cff] to-[#0062d6] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_16px_48px_-12px_rgb(0_113_227/0.55)]">
        <Icon name="scale" size={60} strokeWidth={1.5} />
      </span>
      <p className="text-2xl font-semibold text-muted">{caseInfo?.caption}</p>
      <h1 className="mt-3 text-7xl font-bold tracking-tight">Jury deliberation in progress</h1>
    </div>
  )
}

function BlackoutView() {
  return (
    <div className="flex flex-col items-center justify-center text-center my-auto select-none">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface/50 border border-line/40 text-muted shadow-xs mb-4">
        <Icon name="eyeOff" size={32} strokeWidth={1.5} />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-ink/70">Deliberation Display Paused</h2>
      <p className="mt-2 text-base text-muted/70 max-w-md">
        Screen is blacked out for jury confidentiality. The foreperson will resume the display when appropriate.
      </p>
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
      <header className="group flex items-center justify-between px-10 py-6 text-xl">
        <div>
          <span className="font-semibold">{caseInfo?.caption}</span>
          <span className="ml-4 text-muted">Deliberation</span>
        </div>
        <div className="flex items-center gap-6 text-muted">
          {!connected && <span className="text-warn">Reconnecting…</span>}
          <span className="text-2xl font-semibold text-ink"><Clock /></span>
          <div className="material flex gap-1 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button type="button" className="pressable rounded-full p-2 hover:bg-fill" onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Full screen"><Icon name="maximize" /></button>
            <button type="button" className="pressable rounded-full p-2 hover:bg-fill" onClick={toggleTheme} aria-label="Toggle dark mode"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
            <button type="button" className="pressable rounded-full p-2 hover:bg-fill" onClick={logout} aria-label="Sign out"><Icon name="logout" /></button>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-10 py-8 scrollbar-thin">
        {display.view === 'blackout' && <BlackoutView />}
        {display.view === 'timeline' && (
          timeline.length
            ? <div><h1 className="mb-5 text-4xl font-bold">Timeline</h1><Card className="py-2"><Timeline events={timeline} zoom="fit" /></Card></div>
            : <p className="my-auto text-center text-3xl text-muted">The jury’s timeline will appear here.</p>
        )}
        {display.view === 'votes' && <div className="my-auto"><VotesView votes={votes} counts={counts} voteId={display.voteId} /></div>}
        {display.view !== 'blackout' && display.view !== 'timeline' && display.view !== 'votes' && <div className="my-auto"><IdleView caseInfo={caseInfo} /></div>}
      </main>
    </div>
  )
}
