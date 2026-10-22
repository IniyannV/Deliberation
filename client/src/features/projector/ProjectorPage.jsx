import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { load, store } from '../../lib/storage'
import { PARTY_LABEL, TYPE_LABEL, fmtDateTime } from '../../lib/format'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Segmented, Switch, Textarea, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import { ExhibitThumb } from '../evidence/ExhibitLocker'
import { useCountdown } from '../../lib/useCountdown'
import { Clock, DisplayHeader, DisplayStage } from '../../pages/display/Display'

/*
 * The foreperson's control screen for the room display: a live preview of
 * what the room sees, one-tap sources, and the options for each source.
 */

// The room display is laid out at this size, then scaled to fit the preview.
const STAGE_W = 1600
const STAGE_H = 900

const SOURCES = [
  { view: 'timeline', label: 'Timeline', icon: 'timeline', hint: 'The shared timeline, live', tint: 'from-[#5e5ce6] to-[#4b49c9]' },
  { view: 'votes', label: 'Votes', icon: 'vote', hint: 'Poll and ballot results', tint: 'from-[#ff9f0a] to-[#ff7a00]' },
  { view: 'evidence', label: 'Evidence', icon: 'folder', hint: 'Any admitted exhibit', tint: 'from-[#3b8cff] to-[#0062d6]' },
  { view: 'message', label: 'Announcement', icon: 'chat', hint: 'A message, with a countdown', tint: 'from-[#30d158] to-[#24a148]' },
  { view: 'idle', label: 'Welcome', icon: 'scale', hint: 'The case caption', tint: 'from-[#8e8e93] to-[#636366]' },
  { view: 'blackout', label: 'Blackout', icon: 'eyeOff', hint: 'A blank, paused screen', tint: 'from-[#48484a] to-[#1c1c1e]' },
]

const PRESETS = [
  { text: 'Short break', minutes: 15 },
  { text: 'Lunch break', minutes: 60 },
  { text: 'Please take your seats', minutes: 0 },
  { text: 'Deliberation will resume shortly', minutes: 0 },
  { text: 'Waiting for a response from the court', minutes: 0 },
]

const COUNTDOWNS = [
  { value: 0, label: 'None' },
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hr' },
]

// One entry in "Recently shown". Only what that view needs, so equal shows compare equal.
const snapshot = (d) => ({
  view: d.view,
  ...(d.view === 'evidence' && { exhibitId: d.exhibitId }),
  ...(d.view === 'votes' && { voteId: d.voteId }),
  ...(d.view === 'message' && { message: d.message }),
})
// The same announcement with a changed countdown is still the same show.
const showKey = (d) => JSON.stringify({ ...snapshot(d), ...(d.view === 'message' && { message: d.message?.text }) })
const sameShow = (a, b) => showKey(a) === showKey(b)
// A remembered announcement whose countdown has run out comes back without one.
const recall = (r) => (r.message?.endsAt && new Date(r.message.endsAt) <= Date.now() ? { ...r, message: { ...r.message, endsAt: null } } : r)

function useDescribe() {
  const exhibits = useLive((s) => s.exhibits)
  const votes = useLive((s) => s.votes)
  const counts = useLive((s) => s.counts)
  return (d) => {
    if (d.view === 'evidence') {
      const e = exhibits.find((x) => x.id === d.exhibitId)
      return e ? `Exhibit ${e.number}: ${e.title}` : 'Evidence (none chosen)'
    }
    if (d.view === 'votes') {
      const v = votes.find((x) => x.id === d.voteId)
      if (!v) return 'Latest poll or ballot'
      return `${v.kind === 'ballot' ? 'Ballot' : 'Poll'}: ${v.kind === 'ballot' ? counts.find((c) => c.id === v.countId)?.label ?? v.question : v.question}`
    }
    if (d.view === 'message') return `“${d.message?.text ?? ''}”`
    return SOURCES.find((s) => s.view === d.view)?.label ?? 'Welcome'
  }
}

/** The room display, drawn at full size and scaled down to fit. */
function StagePreview({ display }) {
  const caseInfo = useAuth((s) => s.caseInfo)
  const box = useRef(null)
  const [scale, setScale] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    const measure = () => setScale(el.clientWidth / STAGE_W)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={box} inert className="relative aspect-video w-full overflow-hidden rounded-xl bg-bg ring-1 ring-line/60 select-none">
      <div className="absolute top-0 left-0 flex origin-top-left flex-col bg-bg" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}>
        <DisplayHeader caseInfo={caseInfo} view={display.view}>
          <span className="text-2xl font-semibold text-ink"><Clock /></span>
        </DisplayHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-10 py-8">
          <DisplayStage display={display} preview />
        </div>
      </div>
    </div>
  )
}

function SourceTile({ source, live, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        'pressable pressable-soft flex flex-col items-start gap-2 rounded-2xl border bg-surface p-3.5 text-left shadow-card transition-[border-color,box-shadow]',
        selected ? 'border-accent ring-2 ring-accent/25' : 'border-line/40 hover:border-line',
      )}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className={cx('flex h-9 w-9 items-center justify-center rounded-[0.6rem] bg-linear-to-b text-white shadow-xs', source.tint)}>
          <Icon name={source.icon} size={18} strokeWidth={2} />
        </span>
        {live && (
          <Badge tone={source.view === 'blackout' ? 'danger' : 'ok'} className="px-2 py-0 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-current" /> Live
          </Badge>
        )}
      </div>
      <div>
        <p className="font-semibold text-ink">{source.label}</p>
        <p className="text-xs leading-snug text-muted">{source.hint}</p>
      </div>
    </button>
  )
}

function EvidenceOptions({ display, project }) {
  const exhibits = useLive((s) => s.exhibits)
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = exhibits.filter((e) =>
    (!type || e.type === type || (type === 'video' && e.type === 'youtube'))
    && terms.every((t) => `${e.number} ${e.title} ${e.description ?? ''}`.toLowerCase().includes(t)))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-60 flex-1">
          <span className="sr-only">Find an exhibit</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an exhibit by number or title…" className="pl-10" />
        </label>
        <Segmented
          label="Exhibit type"
          value={type}
          onChange={setType}
          options={[{ value: '', label: 'All' }, { value: 'pdf', label: 'Documents' }, { value: 'image', label: 'Images' }, { value: 'transcript', label: 'Transcripts' }, { value: 'video', label: 'Video' }]}
        />
      </div>
      {shown.length ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] gap-3.5">
          {shown.map((e) => {
            const live = display.view === 'evidence' && display.exhibitId === e.id
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => project({ view: 'evidence', exhibitId: e.id }, `Exhibit ${e.number} is on the room display.`)}
                  className={cx('pressable pressable-soft flex h-full w-full flex-col overflow-hidden rounded-xl border bg-surface text-left shadow-card', live ? 'border-accent ring-2 ring-accent/25' : 'border-line/40')}
                >
                  <ExhibitThumb exhibit={e} className="h-24" />
                  <div className="flex flex-1 flex-col gap-1 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="accent" className="px-2 py-0 text-xs">{e.number}</Badge>
                      {live && <Badge tone="ok" className="px-2 py-0 text-xs"><Icon name="monitor" size={11} /> Live</Badge>}
                    </div>
                    <p className="line-clamp-2 text-sm leading-snug font-semibold">{e.title}</p>
                    <p className="text-xs text-muted">{TYPE_LABEL[e.type]} · {PARTY_LABEL[e.party]}</p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState icon="search" title="No exhibits match">Try fewer words, or another type.</EmptyState>
      )}
    </div>
  )
}

function VoteOptions({ display, project }) {
  const votes = useLive((s) => s.votes)
  const counts = useLive((s) => s.counts)
  const autoProject = useLive((s) => s.autoProject)
  const setAutoProject = useLive((s) => s.setAutoProject)
  const list = [...votes].filter((v) => v.status !== 'voided').sort((a, b) => (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt))
  const row = (key, voteId, title, meta, badge) => {
    const live = display.view === 'votes' && (display.voteId ?? null) === voteId
    return (
      <li key={key}>
        <button
          type="button"
          onClick={() => project({ view: 'votes', voteId }, 'Votes are on the room display.')}
          className={cx('pressable pressable-soft flex w-full items-center justify-between gap-3 rounded-xl border bg-surface px-4 py-3 text-left', live ? 'border-accent ring-2 ring-accent/25' : 'border-line/40 hover:border-line')}
        >
          <div className="min-w-0">
            <p className="truncate font-semibold">{title}</p>
            <p className="text-xs text-muted">{meta}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {badge}
            {live && <Badge tone="ok" className="px-2 py-0 text-xs"><Icon name="monitor" size={11} /> Live</Badge>}
          </div>
        </button>
      </li>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {row('latest', null, 'Always the latest', 'Follows whichever poll or ballot is open or most recent')}
        {list.map((v) => row(
          v.id,
          v.id,
          v.kind === 'ballot' ? counts.find((c) => c.id === v.countId)?.label ?? v.question : v.question,
          `${v.kind === 'ballot' ? 'Secret ballot' : 'Poll'} · ${fmtDateTime(v.closedAt ?? v.openedAt)}`,
          v.status === 'open' ? <Badge tone="warn" className="px-2 py-0 text-xs">Open</Badge> : null,
        ))}
      </ul>
      {!list.length && <p className="px-1 text-sm text-muted">No polls or ballots yet. Open one from <Link to="/juror/voting" className="text-accent hover:underline">Polls &amp; ballots</Link>.</p>}
      <label className="flex items-center justify-between gap-4 rounded-xl bg-fill/50 px-4 py-3">
        <span>
          <span className="block font-semibold">Switch to new polls and ballots</span>
          <span className="block text-xs text-muted">When you open one, the room display shows it straight away. Secret ballots never show a running count.</span>
        </span>
        <Switch checked={autoProject} onChange={setAutoProject} label="Switch to new polls and ballots" />
      </label>
    </div>
  )
}

function MessageOptions({ display, project }) {
  const current = display.message
  const countdown = useCountdown(current?.endsAt)
  const running = countdown?.left > 0
  const [text, setText] = useState(current?.text ?? '')
  const [minutes, setMinutes] = useState(running ? -1 : 0)

  function show() {
    const endsAt = minutes === -1 && running ? current.endsAt : minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : null
    project({ view: 'message', message: { text, endsAt } }, 'Your announcement is on the room display.')
  }
  const extend = (m) => project({
    view: 'message',
    message: { text: current.text, endsAt: new Date(Math.max(Date.now(), new Date(current.endsAt).getTime()) + m * 60_000).toISOString() },
  })

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={160}
          placeholder="What should the room see? For example, “Short break”."
          className="min-h-24 text-lg"
          aria-label="Announcement"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Countdown"
            value={minutes}
            onChange={setMinutes}
            options={running ? [{ value: -1, label: 'Keep current' }, ...COUNTDOWNS] : COUNTDOWNS}
          />
          <Button variant="primary" icon="monitor" disabled={!text.trim()} onClick={show}>
            {display.view === 'message' ? 'Update display' : 'Show on display'}
          </Button>
        </div>
        {running && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm">
            <Icon name="clock" size={16} className="text-accent" />
            <span className="font-semibold text-accent tabular-nums">{countdown.label} left</span>
            <span className="text-muted">{display.view === 'message' ? 'on the room display' : 'when the announcement is shown'}</span>
            <span className="ml-auto flex gap-1.5">
              <Button size="sm" onClick={() => extend(5)}>+5 min</Button>
              <Button size="sm" variant="ghost" onClick={() => project({ view: 'message', message: { text: current.text, endsAt: null } })}>Stop countdown</Button>
            </span>
          </div>
        )}
      </div>
      <div>
        <p className="mb-2 px-1 text-sm font-semibold text-muted">Quick messages</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.text}
              type="button"
              onClick={() => { setText(p.text); setMinutes(p.minutes) }}
              className="pressable pressable-soft rounded-full border border-line/50 bg-surface px-3.5 py-1.5 text-sm font-medium hover:border-line"
            >
              {p.text}{p.minutes ? <span className="text-muted"> · {p.minutes < 60 ? `${p.minutes} min` : '1 hr'}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SimpleOptions({ view }) {
  const copy = {
    timeline: <>The room display shows the jury’s shared timeline and updates as anyone edits it. <Link to="/juror/timeline" className="text-accent hover:underline">Open the timeline</Link></>,
    idle: 'A calm screen with the case caption. Use it between topics, or when nothing needs to be on the wall.',
    blackout: 'The room display goes blank and says it is paused. Use it while the jury discusses anything that shouldn’t stay on the wall. Resume brings back what was showing before.',
  }
  return <p className="text-muted">{copy[view]}</p>
}

export default function ProjectorPage() {
  const emit = useLive((s) => s.emit)
  const display = useLive((s) => s.display)
  const online = useLive((s) => s.displayOnline)
  const connected = useLive((s) => s.connected)
  const describe = useDescribe()
  const [panel, setPanel] = useState(display.view)
  const [recent, setRecent] = useState(() => load('projectorRecent', []))

  // Remember what's been shown (by anyone's control), newest first, for one-tap recall.
  useEffect(() => {
    if (display.view === 'blackout' || (display.view === 'evidence' && !display.exhibitId)) return
    setRecent((list) => {
      if (list[0] && sameShow(list[0], display)) return list
      const next = [snapshot(display), ...list.filter((r) => !sameShow(r, display))].slice(0, 6)
      store('projectorRecent', next)
      return next
    })
  }, [display])

  async function project(next, message) {
    try {
      await emit('display:set', { voteId: display.voteId, exhibitId: display.exhibitId, ...next })
      if (message) toast(message)
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  function pick(view) {
    setPanel(view)
    if (view === 'evidence' && !display.exhibitId) return // choose one below first
    if (view === 'message' && !display.message) return // write one below first
    if (view !== display.view) project({ view })
  }

  const blackedOut = display.view === 'blackout'
  const resumeTo = recent.find((r) => r.view !== 'blackout') ?? { view: 'timeline' }
  const history = useMemo(() => recent.filter((r) => !sameShow(r, display)), [recent, display])
  const source = SOURCES.find((s) => s.view === panel) ?? SOURCES[0]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Room projector"
        subtitle="Choose what the jury room’s wall display shows. The preview is exactly what the room sees."
        actions={
          <Badge tone={!connected ? 'neutral' : online ? 'ok' : 'warn'} className="px-3 py-1 text-sm">
            <span className={cx('h-2 w-2 rounded-full bg-current', online && connected && 'animate-pulse')} />
            {!connected ? 'Reconnecting…' : online ? 'Projector connected' : 'Projector offline'}
          </Badge>
        }
      />

      {connected && !online && (
        <p className="-mt-3 flex items-start gap-2 rounded-xl bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          No room display is signed in. Your choices are saved and will appear as soon as the projector signs in as DISPLAY.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="flex flex-col gap-3 p-4" data-tour="projector-preview">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Now showing</p>
              <p className="truncate font-semibold">{describe(display)}</p>
            </div>
            <Badge tone={blackedOut ? 'danger' : 'ok'}>{blackedOut ? 'Blacked out' : 'Live'}</Badge>
          </div>
          <StagePreview display={display} />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="flex-1"
              variant={blackedOut ? 'primary' : 'danger'}
              icon={blackedOut ? 'eye' : 'eyeOff'}
              onClick={() => (blackedOut ? project(recall(resumeTo)) : project({ view: 'blackout' }))}
            >
              {blackedOut ? `Resume: ${describe(resumeTo)}` : 'Blackout now'}
            </Button>
            {display.view === 'evidence' && display.exhibitId && (
              <Link to={`/juror/evidence/${display.exhibitId}`}>
                <Button icon="external">Open exhibit</Button>
              </Link>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 content-start gap-3" data-tour="projector-sources">
          {SOURCES.map((s) => (
            <SourceTile key={s.view} source={s} live={display.view === s.view} selected={panel === s.view} onClick={() => pick(s.view)} />
          ))}
        </div>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <Icon name={source.icon} size={18} /> {source.label}
        </h2>
        {panel === 'evidence' && <EvidenceOptions display={display} project={project} />}
        {panel === 'votes' && <VoteOptions display={display} project={project} />}
        {panel === 'message' && <MessageOptions key={display.message?.text ?? ''} display={display} project={project} />}
        {['timeline', 'idle', 'blackout'].includes(panel) && <SimpleOptions view={panel} />}
      </Card>

      {history.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-muted">Recently shown</h2>
          <div className="flex flex-wrap gap-2">
            {history.map((r) => (
              <button
                key={showKey(r)}
                type="button"
                onClick={() => { setPanel(r.view); project(recall(r)) }}
                className="pressable pressable-soft flex max-w-80 items-center gap-2 rounded-full border border-line/50 bg-surface py-1.5 pr-4 pl-3 text-sm font-medium shadow-xs hover:border-line"
              >
                <Icon name={SOURCES.find((s) => s.view === r.view)?.icon ?? 'monitor'} size={15} className="shrink-0 text-muted" />
                <span className="truncate">{describe(r)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
