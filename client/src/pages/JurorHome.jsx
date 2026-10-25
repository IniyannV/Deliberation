import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { unreadChat, unreadRequestReplies, useLive } from '../store/live'
import { Icon } from '../components/icons'
import { Badge, Button, CountBadge, cx } from '../components/ui'

export default function JurorHome() {
  const { user, caseInfo } = useAuth()
  const {
    votes,
    votedIn,
    timeline,
    exhibits,
    myRequests,
    myChat,
    personal,
    counts: liveCounts,
    connected,
  } = useLive()

  const counts = liveCounts.length ? liveCounts : caseInfo?.counts ?? []

  const openVotes = votes.filter((v) => v.status === 'open')
  const pendingVotes = openVotes.filter((v) => !votedIn.includes(v.id))
  const toVote = pendingVotes.length
  const notebook = personal.notebook ?? []
  const lastNote = notebook.reduce((a, n) => (!a || n.updatedAt > a.updatedAt ? n : a), null)
  const fromBailiff = useLive((s) => unreadRequestReplies(s) + unreadChat(s))
  const activeRequests = (myRequests ?? []).filter((r) => r.status !== 'fulfilled')

  const requestResponses = (myRequests ?? []).reduce(
    (acc, r) => acc + (r.messages?.filter((m) => m.from === 'bailiff').length ?? 0) + (r.answer ? 1 : 0),
    0
  )
  const chatResponses = myChat?.messages?.filter((m) => m.from === 'bailiff').length ?? 0
  const bailiffResponses = requestResponses + chatResponses

  const docCount = exhibits.filter((e) => e.type === 'pdf').length
  const photoCount = exhibits.filter((e) => e.type === 'image').length
  const videoCount = exhibits.filter((e) => e.type === 'video' || e.type === 'youtube').length
  const transcriptCount = exhibits.filter((e) => e.type === 'transcript').length

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="py-1 sm:py-2">
      {/* Court session & case banner */}
      <header className="mb-4 sm:mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
          <span>{today} · {caseInfo?.court || 'Superior Court of California'}</span>
          <span className="inline-flex items-center gap-1.5 normal-case font-medium text-muted">
            <span className={cx('h-2 w-2 rounded-full', connected ? 'bg-ok shadow-[0_0_6px_rgba(48,209,88,0.5)]' : 'bg-warn')} />
            {connected ? 'Court server connected' : 'Reconnecting to court server…'}
          </span>
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-ink leading-tight">
          {caseInfo?.caption || 'Jury Deliberation Portal'}
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted">
          {caseInfo?.caseNumber && <span>Case {caseInfo.caseNumber} ·</span>}
          <span>Logged in as <strong className="font-semibold text-ink">{user?.name}</strong></span>
          {user?.role === 'foreperson' && (
            <span className="inline-flex items-center rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-accent-ink shadow-xs">
              Foreperson
            </span>
          )}
        </div>
      </header>

      {/* Action alerts: open ballots */}
      {pendingVotes.map((v) => (
        <div
          key={v.id}
          className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent-soft p-4 shadow-card"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-sm">
              <Icon name="vote" size={22} strokeWidth={2.2} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <Badge tone={v.kind === 'ballot' ? 'warn' : 'accent'} className="px-2 py-0.5 text-xs">
                  {v.kind === 'ballot' ? 'Secret ballot open' : 'Poll open'}
                </Badge>
                <span className="text-xs font-semibold text-muted">Your vote is pending</span>
              </div>
              <h2 className="text-base font-bold text-ink mt-0.5">{v.question}</h2>
            </div>
          </div>
          <Link to="/juror/voting" className="shrink-0 w-full sm:w-auto">
            <Button variant="primary" size="sm" className="w-full sm:w-auto px-4 text-xs">
              Cast your vote →
            </Button>
          </Link>
        </div>
      ))}

      {/* Main Deliberation Menu Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 sm:gap-4">
        {/* ROW 1: PRIMARY PILLARS (50% / 50% width on large screens) */}
        
        {/* 1. Polls & Ballots */}
        <Link
          to="/juror/voting"
          className={cx(
            'group pressable pressable-soft flex flex-col justify-between rounded-2xl bg-surface p-5 shadow-card hover:shadow-lift border transition-all duration-200 lg:col-span-3 min-h-[155px]',
            toVote > 0
              ? 'border-accent/60 ring-2 ring-accent/30'
              : 'border-line/40 hover:border-line'
          )}
        >
          <div>
            <div className="mb-3.5 flex items-start justify-between gap-2.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-b from-[#ff9f0a] to-[#ff7a00] text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.4),0_2px_8px_rgb(255_159_10/0.3)]">
                <Icon name="vote" size={22} strokeWidth={2.2} />
              </span>
              <div className="flex items-center gap-1.5">
                {toVote > 0 ? (
                  <Badge tone="warn" className="px-2 py-0.5 text-xs">Vote pending</Badge>
                ) : (
                  <Badge tone="neutral" className="px-2 py-0.5 text-xs">{counts.length} counts</Badge>
                )}
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fill/50 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink">
                  <Icon name="chevronRight" size={15} strokeWidth={2.5} />
                </span>
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-ink tabular-nums">
                {toVote > 0 ? toVote : votes.length}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                {toVote > 0 ? 'vote pending' : 'votes on record'}
              </span>
            </div>

            <h2 className="mt-1 text-lg sm:text-xl font-bold text-ink group-hover:text-accent transition-colors">
              Polls &amp; Ballots
            </h2>
          </div>

          <div className="mt-4 pt-3 border-t border-line/40 flex items-center justify-between text-xs font-semibold">
            <span className="text-muted truncate">
              {counts.length > 0 ? `${counts.length} statutory count${counts.length === 1 ? '' : 's'} under deliberation` : 'Verdict voting'}
            </span>
            <span className="text-accent inline-flex items-center gap-0.5 group-hover:underline shrink-0 ml-1">
              {toVote > 0 ? 'Cast vote now' : 'View ballots'} →
            </span>
          </div>
        </Link>

        {/* 2. Exhibit Locker */}
        <Link
          to="/juror/evidence"
          className="group pressable pressable-soft flex flex-col justify-between rounded-2xl bg-surface p-5 shadow-card hover:shadow-lift border border-line/40 hover:border-line transition-all duration-200 lg:col-span-3 min-h-[155px]"
        >
          <div>
            <div className="mb-3.5 flex items-start justify-between gap-2.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-b from-[#3b8cff] to-[#0062d6] text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.4),0_2px_8px_rgb(0_113_227/0.3)]">
                <Icon name="folder" size={22} strokeWidth={2.2} />
              </span>
              <div className="flex items-center gap-1.5">
                <Badge tone="neutral" className="px-2 py-0.5 text-xs">Admitted record</Badge>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fill/50 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink">
                  <Icon name="chevronRight" size={15} strokeWidth={2.5} />
                </span>
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-ink tabular-nums">
                {exhibits.length}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                exhibits admitted
              </span>
            </div>

            <h2 className="mt-1 text-lg sm:text-xl font-bold text-ink group-hover:text-accent transition-colors">
              Exhibit Locker
            </h2>
          </div>

          <div className="mt-4 pt-3 border-t border-line/40 flex items-center justify-between text-xs font-semibold">
            <span className="text-muted truncate">
              {docCount} docs · {photoCount} photos · {videoCount} video · {transcriptCount} transcripts
            </span>
            <span className="text-accent inline-flex items-center gap-0.5 group-hover:underline shrink-0 ml-1">
              Browse locker →
            </span>
          </div>
        </Link>

        {/* ROW 2: WORKSPACE & SERVICE TOOLS (33% each on large screens) */}

        {/* 3. Case Timeline */}
        <Link
          to="/juror/timeline"
          className="group pressable pressable-soft flex flex-col justify-between rounded-2xl bg-surface p-5 shadow-card hover:shadow-lift border border-line/40 hover:border-line transition-all duration-200 sm:col-span-2 lg:col-span-2 min-h-[150px]"
        >
          <div>
            <div className="mb-3 flex items-start justify-between gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-b from-[#8e8cff] to-[#5856d6] text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.4),0_2px_8px_rgb(88_86_214/0.3)]">
                <Icon name="timeline" size={20} strokeWidth={2.2} />
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fill/50 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink">
                <Icon name="chevronRight" size={15} strokeWidth={2.5} />
              </span>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink tabular-nums">
                {timeline.length}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                events logged
              </span>
            </div>

            <h2 className="mt-1 text-base sm:text-lg font-bold text-ink group-hover:text-accent transition-colors">
              Case Timeline
            </h2>
          </div>

          <div className="mt-4 pt-3 border-t border-line/40 flex items-center justify-between text-xs font-semibold">
            <span className="text-muted truncate">
              {timeline.length > 0 ? 'Live room sync' : 'Chronology'}
            </span>
            <span className="text-accent inline-flex items-center gap-0.5 group-hover:underline shrink-0 ml-1">
              Open →
            </span>
          </div>
        </Link>

        {/* 4. Ask the Bailiff */}
        <Link
          to="/juror/requests"
          className="group pressable pressable-soft flex flex-col justify-between rounded-2xl bg-surface p-5 shadow-card hover:shadow-lift border border-line/40 hover:border-line transition-all duration-200 sm:col-span-1 lg:col-span-2 min-h-[150px]"
        >
          <div>
            <div className="mb-3 flex items-start justify-between gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-b from-[#ff6b6b] to-[#ff3b30] text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.4),0_2px_8px_rgb(255_59_48/0.3)]">
                <Icon name="bell" size={20} strokeWidth={2.2} />
              </span>
              <div className="flex items-center gap-1.5">
                {fromBailiff > 0 ? (
                  <Badge tone="accent" className="px-2 py-0.5 text-xs">{fromBailiff} new</Badge>
                ) : activeRequests.length > 0 ? (
                  <Badge tone="warn" className="px-2 py-0.5 text-xs">{activeRequests.length} active</Badge>
                ) : (
                  <Badge tone="neutral" className="px-2 py-0.5 text-xs">Direct line</Badge>
                )}
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fill/50 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink">
                  <Icon name="chevronRight" size={15} strokeWidth={2.5} />
                </span>
              </div>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink tabular-nums">
                {fromBailiff > 0 ? fromBailiff : bailiffResponses}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {fromBailiff > 0
                  ? (fromBailiff === 1 ? 'new response' : 'new responses')
                  : (bailiffResponses === 1 ? 'response received' : 'responses received')}
              </span>
            </div>

            <h2 className="mt-1 flex items-center gap-2 text-base sm:text-lg font-bold text-ink group-hover:text-accent transition-colors">
              Ask the Bailiff
              <CountBadge count={fromBailiff} />
            </h2>
          </div>

          <div className="mt-4 pt-3 border-t border-line/40 flex items-center justify-between text-xs font-semibold">
            <span className="text-muted truncate">
              {fromBailiff > 0
                ? `${fromBailiff} new from the bailiff`
                : activeRequests.length > 0
                  ? `${activeRequests.length} request${activeRequests.length === 1 ? '' : 's'} active`
                  : bailiffResponses > 0
                    ? `${bailiffResponses} total response${bailiffResponses === 1 ? '' : 's'}`
                    : 'Recesses & meals'}
            </span>
            <span className="text-accent inline-flex items-center gap-0.5 group-hover:underline shrink-0 ml-1">
              Request →
            </span>
          </div>
        </Link>

        {/* 5. My Notes */}
        <Link
          to="/juror/notes"
          className="group pressable pressable-soft flex flex-col justify-between rounded-2xl bg-surface p-5 shadow-card hover:shadow-lift border border-line/40 hover:border-line transition-all duration-200 sm:col-span-1 lg:col-span-2 min-h-[150px]"
        >
          <div>
            <div className="mb-3 flex items-start justify-between gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-b from-[#34c759] to-[#248a3d] text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.4),0_2px_8px_rgb(52_199_89/0.3)]">
                <Icon name="note" size={20} strokeWidth={2.2} />
              </span>
              <div className="flex items-center gap-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fill/50 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink">
                  <Icon name="chevronRight" size={15} strokeWidth={2.5} />
                </span>
              </div>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink tabular-nums">
                {notebook.length}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {notebook.length === 1 ? 'note' : 'notes'}
              </span>
            </div>

            <h2 className="mt-1 text-base sm:text-lg font-bold text-ink group-hover:text-accent transition-colors">
              My Notes
            </h2>
          </div>

          <div className="mt-4 pt-3 border-t border-line/40 flex items-center justify-between text-xs font-semibold">
            <span className="text-muted truncate">
              {lastNote ? `Last edited: ${lastNote.title || 'Untitled note'}` : 'Private to you'}
            </span>
            <span className="text-accent inline-flex items-center gap-0.5 group-hover:underline shrink-0 ml-1">
              Write →
            </span>
          </div>
        </Link>
      </div>

      {/* Courtroom Admonition Footer */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-surface p-4 shadow-card border border-line/50 border-l-4 border-l-accent">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Icon name="shield" size={18} strokeWidth={2} />
          </span>
          <p className="text-xs sm:text-[13px] text-muted leading-relaxed">
            <strong className="font-semibold text-ink">Courtroom Admonition:</strong> All deliberations must remain strictly confidential. Decide solely on the evidence admitted in trial.
          </p>
        </div>
        <Link to="/juror/requests" className="shrink-0">
          <Button variant="ghost" size="sm" icon="coffee" className="text-xs h-8 px-3.5">
            Request a Recess
          </Button>
        </Link>
      </div>
    </div>
  )
}

