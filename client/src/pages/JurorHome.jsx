import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useLive } from '../store/live'
import { Icon } from '../components/icons'
import { cx } from '../components/ui'

// Settings-style icon tiles: each destination gets its own system colour.
const TINT = {
  vote: 'from-[#ff9f0a] to-[#ff7a00]',
  folder: 'from-[#3b8cff] to-[#0062d6]',
  timeline: 'from-[#8e8cff] to-[#5856d6]',
  mail: 'from-[#4cd964] to-[#28b446]',
  bell: 'from-[#ff6b6b] to-[#ff3b30]',
}

function Tile({ to, icon, title, value, children, highlight }) {
  return (
    <Link
      to={to}
      className={cx(
        'pressable pressable-soft group flex flex-col rounded-3xl bg-surface p-5 shadow-card hover:shadow-[var(--shadow-lift)]',
        highlight && 'ring-2 ring-accent',
      )}
    >
      <div className="mb-6 flex items-start justify-between">
        <span className={cx('flex h-11 w-11 items-center justify-center rounded-[0.75rem] bg-linear-to-b text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.35)]', TINT[icon])}>
          <Icon name={icon} size={23} strokeWidth={2} />
        </span>
        <Icon name="chevronRight" size={18} className="mt-1 text-muted/60 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
      {value != null && <span className="text-[2.5rem] leading-none font-bold tracking-tight tabular-nums">{value}</span>}
      <span className="mt-2 text-lg font-semibold">{title}</span>
      <span className="text-muted">{children}</span>
    </Link>
  )
}

export default function JurorHome() {
  const { user, caseInfo } = useAuth()
  const { votes, votedIn, updates, timeline, exhibits, myRequests } = useLive()
  const toVote = votes.filter((v) => v.status === 'open' && !votedIn.includes(v.id)).length
  const unread = updates.filter((u) => !u.readAt).length
  const activeRequests = myRequests.filter((r) => r.status !== 'fulfilled').length
  const today = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="max-w-5xl">
      <p className="text-sm font-semibold text-muted uppercase">{today}</p>
      <h1 className="mt-1 text-[2.125rem] font-bold">Welcome, {user?.name}</h1>
      <p className="mt-1 mb-8 text-[1.0625rem] text-muted">
        {user?.role === 'foreperson' && <>Foreperson · </>}{caseInfo?.caption} · {caseInfo?.court}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile to="/juror/voting" icon="vote" title="Polls & ballots" value={toVote} highlight={toVote > 0}>
          {toVote ? 'Waiting for your vote' : 'Nothing waiting for your vote'}
        </Tile>
        <Tile to="/juror/evidence" icon="folder" title="Exhibit locker" value={exhibits.length}>Exhibits admitted</Tile>
        <Tile to="/juror/timeline" icon="timeline" title="Timeline" value={timeline.length}>
          {timeline.length ? 'Events so far' : 'Start building it together'}
        </Tile>
        <Tile to="/juror/bulletin" icon="mail" title="Messages from home" value={unread} highlight={unread > 0}>
          {unread ? `New message${unread === 1 ? '' : 's'}` : 'No new messages'}
        </Tile>
        <Tile to="/juror/requests" icon="bell" title="Requests" value={activeRequests}>
          {activeRequests ? 'In progress' : 'Breaks, meals, supplies'}
        </Tile>
      </div>

      <div className="mt-8 flex gap-4 rounded-3xl bg-surface p-6 shadow-card">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok"><Icon name="leaf" size={22} /></span>
        <div>
          <h2 className="mb-1 text-lg font-semibold">A gentle reminder</h2>
          <p className="text-muted">
            Deliberation is tiring. It’s fine to ask the bailiff for a break at any time.
            Please don’t research the case or discuss it outside this room.
          </p>
        </div>
      </div>
    </div>
  )
}
