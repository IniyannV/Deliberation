import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useLive } from '../store/live'
import { toast } from '../store/ui'
import { Icon } from '../components/icons'
import { Badge, Button, Card, cx } from '../components/ui'
import {
  PARTY_LABEL,
  REQUEST_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
  fmtCalendarDate,
  timeAgo,
} from '../lib/format'

const TYPE_ICON = { pdf: 'file', image: 'image', transcript: 'text', video: 'video', youtube: 'video' }
const STATUS_TONE = { pending: 'warn', acknowledged: 'accent', fulfilled: 'ok' }

export default function JurorHome() {
  const { user, caseInfo } = useAuth()
  const {
    votes,
    votedIn,
    updates,
    timeline,
    exhibits,
    myRequests,
    counts: liveCounts,
    burden: liveBurden,
    personal,
    connected,
  } = useLive()

  const counts = liveCounts.length ? liveCounts : caseInfo?.counts ?? []
  const burden = liveBurden || caseInfo?.burden || ''
  const personalChecks = personal?.checks ?? {}

  const [expandedCounts, setExpandedCounts] = useState(() => new Set())

  const toVote = votes.filter((v) => v.status === 'open' && !votedIn.includes(v.id)).length
  const unread = updates.filter((u) => !u.readAt).length
  const activeRequests = myRequests.filter((r) => r.status !== 'fulfilled')

  const openVotes = votes.filter((v) => v.status === 'open')
  const pendingVotes = openVotes.filter((v) => !votedIn.includes(v.id))
  const completedOpenVotes = openVotes.filter((v) => votedIn.includes(v.id))

  const unreadUpdates = updates.filter((u) => !u.readAt)

  const previewExhibits = useMemo(() => exhibits.slice(0, 5), [exhibits])

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const toggleExpand = (id) => {
    setExpandedCounts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function toggleElementCheck(countId, elementIdx) {
    const live = useLive.getState()
    const checks = live.personal?.checks?.[countId] ?? []
    const ticked = new Set(checks)
    const checked = !ticked.has(elementIdx)
    const next = checked ? [...ticked, elementIdx].sort((a, b) => a - b) : [...ticked].filter((x) => x !== elementIdx)
    useLive.setState({
      personal: {
        ...live.personal,
        checks: { ...live.personal?.checks, [countId]: next },
      },
    })
    try {
      await live.emit('check:set', { countId, element: elementIdx, checked })
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  return (
    <div className="max-w-6xl pb-12">
      {/* Court session & case banner */}
      <header className="mb-7">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wider text-muted">
          <span>{today} · {caseInfo?.court || 'Superior Court'}</span>
          <span className="inline-flex items-center gap-1.5 normal-case font-normal text-muted">
            <span className={cx('h-2 w-2 rounded-full', connected ? 'bg-ok' : 'bg-warn')} />
            {connected ? 'Court server connected' : 'Reconnecting to court server…'}
          </span>
        </div>
        <h1 className="mt-2 text-[2.25rem] font-bold tracking-tight text-ink">
          {caseInfo?.caption || 'Jury Deliberation'}
        </h1>
        <p className="mt-1 text-[1.0625rem] text-muted">
          {caseInfo?.caseNumber && <>Case {caseInfo.caseNumber} · </>}
          Logged in as <span className="font-semibold text-ink">{user?.name}</span>
          {user?.role === 'foreperson' && (
            <Badge tone="accent" className="ml-2 font-semibold">Foreperson</Badge>
          )}
        </p>
      </header>

      {/* Action alerts: open ballots, family bulletins */}
      <div className="mb-7 flex flex-col gap-3">
        {pendingVotes.map((v) => (
          <div
            key={v.id}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-accent/40 bg-accent-soft p-5 shadow-card"
          >
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-xs">
                <Icon name="vote" size={20} strokeWidth={2} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={v.kind === 'ballot' ? 'warn' : 'accent'}>
                    {v.kind === 'ballot' ? 'Secret ballot open' : 'Poll open'}
                  </Badge>
                  <span className="text-xs font-medium text-muted">Your vote is pending</span>
                </div>
                <h2 className="mt-1 text-lg font-bold text-ink">{v.question}</h2>
                <p className="text-sm text-muted">
                  {v.kind === 'ballot'
                    ? 'Anonymous secret ballot. Your seat number is never stored alongside your choice.'
                    : 'Informal room poll to gauge where the jury stands.'}
                </p>
              </div>
            </div>
            <Link to="/juror/voting" className="shrink-0 w-full sm:w-auto">
              <Button variant="primary" size="md" className="w-full">
                Cast your vote →
              </Button>
            </Link>
          </div>
        ))}

        {completedOpenVotes.map((v) => (
          <div key={v.id} className="flex items-center justify-between gap-4 rounded-2xl bg-surface px-5 py-3.5 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ok-soft text-ok">
                <Icon name="check" size={16} strokeWidth={2.5} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Vote recorded: {v.question}</p>
                <p className="text-xs text-muted">Waiting on remaining jurors before results are announced.</p>
              </div>
            </div>
            <Link to="/juror/voting">
              <Button variant="ghost" size="sm">View ballot status</Button>
            </Link>
          </div>
        ))}

        {unreadUpdates.length > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-surface px-5 py-3.5 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon name="mail" size={18} strokeWidth={2} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-ink">
                    {unreadUpdates.length} new family message{unreadUpdates.length === 1 ? '' : 's'}
                  </p>
                  <Badge tone="accent">New</Badge>
                </div>
                <p className="text-xs text-muted">Vetted and approved by the court bailiff.</p>
              </div>
            </div>
            <Link to="/juror/bulletin">
              <Button variant="secondary" size="sm">Open messages →</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: The Charges and Admitted Evidence */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
          {/* Card: The Charges Under Deliberation */}
          <Card className="p-6">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-ink">The Charges Under Deliberation</h2>
                <p className="mt-0.5 text-sm text-muted">
                  What the prosecution must prove beyond a reasonable doubt for each count.
                </p>
              </div>
              <Link to="/juror/voting" className="text-sm font-semibold text-accent hover:underline">
                Ballots &amp; instructions →
              </Link>
            </div>

            <div className="flex flex-col gap-4">
              {counts.map((c) => {
                const isExpanded = expandedCounts.has(c.id)
                const tickedIndices = new Set(personalChecks[c.id] ?? [])
                const tickedCount = tickedIndices.size
                const totalElements = c.elements?.length ?? 0

                return (
                  <div key={c.id} className="rounded-xl border border-line/70 bg-fill/25 p-4 transition-colors">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{c.label?.split(':')[0] || c.label}</Badge>
                        {c.statute && <span className="text-xs font-mono text-muted">{c.statute}</span>}
                      </div>
                      {totalElements > 0 && (
                        tickedCount > 0 ? (
                          <Badge tone="ok">{tickedCount} of {totalElements} elements verified</Badge>
                        ) : (
                          <Badge tone="neutral">{totalElements} elements to prove</Badge>
                        )
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-ink">
                      {c.label?.includes(':') ? c.label.split(':').slice(1).join(':').trim() : c.label}
                    </h3>
                    <p className="mt-1 text-sm text-ink/90 leading-relaxed">{c.summary}</p>

                    {totalElements > 0 && (
                      <div className="mt-3 pt-3 border-t border-line/40">
                        <button
                          type="button"
                          onClick={() => toggleExpand(c.id)}
                          aria-expanded={isExpanded}
                          className="pressable inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                        >
                          <Icon
                            name="chevronRight"
                            size={14}
                            strokeWidth={2.5}
                            className={cx('transition-transform duration-200', isExpanded && 'rotate-90')}
                          />
                          {isExpanded ? 'Hide required elements' : `Review statutory elements (${totalElements})`}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 flex flex-col gap-2.5">
                            <p className="text-xs font-semibold text-muted">
                              Private element tracker (only visible to your seat):
                            </p>
                            <ol className="flex flex-col gap-1.5">
                              {c.elements.map((el, i) => {
                                const on = tickedIndices.has(i)
                                return (
                                  <li key={i}>
                                    <button
                                      type="button"
                                      role="checkbox"
                                      aria-checked={on}
                                      onClick={() => toggleElementCheck(c.id, i)}
                                      className="pressable pressable-soft flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-fill/60"
                                    >
                                      <span
                                        className={cx(
                                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition-colors',
                                          on ? 'border-ok bg-ok text-white' : 'border-line bg-surface text-muted',
                                        )}
                                        aria-hidden
                                      >
                                        {on ? <Icon name="check" size={13} strokeWidth={3} /> : i + 1}
                                      </span>
                                      <span className={cx('text-sm leading-snug', on ? 'text-muted line-through' : 'text-ink')}>
                                        {el}
                                      </span>
                                    </button>
                                  </li>
                                )
                              })}
                            </ol>
                            {c.definitions?.length > 0 && (
                              <div className="mt-2 rounded-lg bg-surface/80 p-3 text-xs border border-line/40">
                                <p className="font-semibold text-ink mb-1">Key Legal Definitions:</p>
                                <ul className="flex flex-col gap-1">
                                  {c.definitions.map((d, di) => (
                                    <li key={di} className="text-muted">
                                      <b className="text-ink">{d.term}:</b> {d.text}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {burden && (
              <div className="mt-5 rounded-xl border border-line/60 bg-surface-2/60 p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                  <Icon name="scale" size={16} className="text-accent" />
                  <span>Court Instruction: Burden of Proof</span>
                </div>
                <p className="text-sm text-ink leading-relaxed">
                  "{burden}"
                </p>
              </div>
            )}
          </Card>

          {/* Card: Admitted Evidence Preview */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink">Admitted Evidence</h2>
                <p className="text-sm text-muted">Exhibits entered into the trial record.</p>
              </div>
              <Link to="/juror/evidence" className="text-sm font-semibold text-accent hover:underline shrink-0">
                Browse all {exhibits.length} exhibits →
              </Link>
            </div>

            <div className="overflow-hidden rounded-xl border border-line/70">
              <ul className="divide-y divide-line">
                {previewExhibits.map((e) => (
                  <li key={e.id}>
                    <Link
                      to={`/juror/evidence/${e.id}`}
                      className="pressable pressable-soft flex items-center justify-between gap-3 p-3.5 hover:bg-fill/50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fill text-muted">
                          <Icon name={TYPE_ICON[e.type] ?? 'file'} size={18} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge tone="accent">{e.number}</Badge>
                            <p className="font-semibold text-ink text-sm truncate">{e.title}</p>
                          </div>
                          <p className="text-xs text-muted truncate mt-0.5">
                            {PARTY_LABEL[e.party] ?? e.party} · {TYPE_LABEL[e.type] ?? e.type} · Admitted {fmtCalendarDate(e.dateAdmitted)}
                          </p>
                        </div>
                      </div>
                      <Icon name="chevronRight" size={16} className="text-muted/60 shrink-0" />
                    </Link>
                  </li>
                ))}
                {!previewExhibits.length && (
                  <li className="p-6 text-center text-sm text-muted">No exhibits admitted yet.</li>
                )}
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>
                {exhibits.filter((e) => e.type === 'pdf').length} documents ·{' '}
                {exhibits.filter((e) => e.type === 'image').length} photographs ·{' '}
                {exhibits.filter((e) => e.type === 'transcript').length} transcripts ·{' '}
                {exhibits.filter((e) => e.type === 'video' || e.type === 'youtube').length} video
              </span>
              <Link to="/juror/review" className="font-semibold text-accent hover:underline">
                Open side-by-side review →
              </Link>
            </div>
          </Card>
        </div>

        {/* Right Column: Workspaces, Bailiff Requests, Deliberation Rules */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
          {/* Card: Deliberation Workspaces Navigation */}
          <Card className="overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-lg font-bold text-ink">Deliberation Workspaces</h2>
              <p className="text-xs text-muted">Collaborative tools for the jury room.</p>
            </div>
            <div className="divide-y divide-line">
              <Link
                to="/juror/evidence"
                className="pressable pressable-soft flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-fill/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-fill text-muted">
                    <Icon name="folder" size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">Exhibit Locker</p>
                    <p className="text-xs text-muted truncate">{exhibits.length} admitted exhibits</p>
                  </div>
                </div>
                <Icon name="chevronRight" size={16} className="text-muted/60 shrink-0" />
              </Link>

              <Link
                to="/juror/review"
                className="pressable pressable-soft flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-fill/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-fill text-muted">
                    <Icon name="columns" size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">Side-by-Side Review</p>
                    <p className="text-xs text-muted truncate">Examine testimony with physical evidence</p>
                  </div>
                </div>
                <Icon name="chevronRight" size={16} className="text-muted/60 shrink-0" />
              </Link>

              <Link
                to="/juror/timeline"
                className="pressable pressable-soft flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-fill/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-fill text-muted">
                    <Icon name="timeline" size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">Case Timeline</p>
                    <p className="text-xs text-muted truncate">
                      {timeline.length ? `${timeline.length} event${timeline.length === 1 ? '' : 's'} chronologized` : 'Collaborative event timeline'}
                    </p>
                  </div>
                </div>
                <Icon name="chevronRight" size={16} className="text-muted/60 shrink-0" />
              </Link>

              <Link
                to="/juror/voting"
                className="pressable pressable-soft flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-fill/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-fill text-muted">
                    <Icon name="vote" size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">Polls &amp; Ballots</p>
                    <p className="text-xs text-muted truncate">
                      {toVote > 0 ? 'Vote waiting for your response' : `${votes.length} vote${votes.length === 1 ? '' : 's'} on record`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {toVote > 0 && <Badge tone="warn">Pending</Badge>}
                  <Icon name="chevronRight" size={16} className="text-muted/60" />
                </div>
              </Link>

              <Link
                to="/juror/bulletin"
                className="pressable pressable-soft flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-fill/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-fill text-muted">
                    <Icon name="mail" size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">Messages from Home</p>
                    <p className="text-xs text-muted truncate">
                      {unread > 0 ? `${unread} unread message${unread === 1 ? '' : 's'}` : `${updates.length} message${updates.length === 1 ? '' : 's'} on bulletin`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {unread > 0 && <Badge tone="accent">{unread} new</Badge>}
                  <Icon name="chevronRight" size={16} className="text-muted/60" />
                </div>
              </Link>
            </div>
          </Card>

          {/* Card: Ask the Bailiff */}
          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">Ask the Bailiff</h2>
              <Link to="/juror/requests" className="text-xs font-semibold text-accent hover:underline">
                Request history →
              </Link>
            </div>
            <p className="mb-4 text-xs text-muted leading-relaxed">
              Request a recess, meal order, or supplies. The court staff will be notified instantly.
            </p>

            {activeRequests.length > 0 && (
              <div className="mb-4 rounded-xl border border-line bg-fill/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink">
                    {REQUEST_LABEL[activeRequests[0].type] ?? 'Request'} in progress
                  </span>
                  <Badge tone={STATUS_TONE[activeRequests[0].status] ?? 'neutral'}>
                    {STATUS_LABEL[activeRequests[0].status] ?? activeRequests[0].status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Submitted {timeAgo(activeRequests[0].createdAt)}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/juror/requests"
                className="pressable pressable-soft flex items-center gap-2 rounded-xl bg-fill px-3 py-2.5 text-xs font-semibold text-ink hover:bg-fill-strong"
              >
                <Icon name="coffee" size={16} className="text-muted shrink-0" />
                <span>Recess</span>
              </Link>
              <Link
                to="/juror/requests"
                className="pressable pressable-soft flex items-center gap-2 rounded-xl bg-fill px-3 py-2.5 text-xs font-semibold text-ink hover:bg-fill-strong"
              >
                <Icon name="utensils" size={16} className="text-muted shrink-0" />
                <span>Order meal</span>
              </Link>
              <Link
                to="/juror/requests"
                className="pressable pressable-soft flex items-center gap-2 rounded-xl bg-fill px-3 py-2.5 text-xs font-semibold text-ink hover:bg-fill-strong"
              >
                <Icon name="box" size={16} className="text-muted shrink-0" />
                <span>Supplies</span>
              </Link>
              {user?.role === 'foreperson' ? (
                <Link
                  to="/juror/requests"
                  className="pressable pressable-soft flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-xs font-semibold text-accent hover:bg-accent/20"
                >
                  <Icon name="question" size={16} className="shrink-0" />
                  <span>Ask judge</span>
                </Link>
              ) : (
                <Link
                  to="/juror/requests"
                  className="pressable pressable-soft flex items-center gap-2 rounded-xl bg-fill px-3 py-2.5 text-xs font-semibold text-ink hover:bg-fill-strong"
                >
                  <Icon name="bell" size={16} className="text-muted shrink-0" />
                  <span>All requests</span>
                </Link>
              )}
            </div>
          </Card>

          {/* Card: Deliberation Rules */}
          <div className="rounded-2xl border border-line bg-surface/50 p-4 text-xs text-muted">
            <div className="mb-1.5 flex items-center gap-2 font-semibold text-ink">
              <Icon name="shield" size={15} className="text-accent" />
              <span>Courtroom Admonition</span>
            </div>
            <p className="leading-relaxed">
              Keep all deliberations strictly confidential within this jury room. Do not conduct
              independent research, visit locations mentioned in testimony, or use personal
              electronic devices. You must decide solely upon the evidence presented during trial
              and the law as stated by the Court.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
