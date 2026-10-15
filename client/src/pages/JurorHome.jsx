import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useLive } from '../store/live'
import { Card } from '../components/ui'
import { Icon } from '../components/icons'

function Tile({ to, icon, title, children, highlight }) {
  return (
    <Link to={to} className={`flex gap-4 rounded-xl border bg-surface p-5 hover:border-accent ${highlight ? 'border-accent/60' : 'border-line'}`}>
      <span className={`h-fit rounded-xl p-3 ${highlight ? 'bg-accent text-accent-ink' : 'bg-accent-soft text-accent'}`}><Icon name={icon} size={24} /></span>
      <span>
        <span className="block text-lg font-bold">{title}</span>
        <span className="text-muted">{children}</span>
      </span>
    </Link>
  )
}

export default function JurorHome() {
  const { user, caseInfo } = useAuth()
  const { votes, votedIn, updates, timeline, exhibits, myRequests } = useLive()
  const toVote = votes.filter((v) => v.status === 'open' && !votedIn.includes(v.id)).length
  const unread = updates.filter((u) => !u.readAt).length
  const activeRequests = myRequests.filter((r) => r.status !== 'fulfilled').length

  return (
    <div className="max-w-5xl">
      <p className="text-lg text-muted">Welcome, {user?.name}{user?.role === 'foreperson' ? ' (foreperson)' : ''}</p>
      <h1 className="mt-1 mb-2 text-3xl font-bold">{caseInfo?.caption}</h1>
      <p className="mb-8 text-muted">{caseInfo?.court}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <Tile to="/juror/voting" icon="vote" title="Polls & ballots" highlight={toVote > 0}>
          {toVote ? `${toVote} waiting for your vote` : 'Nothing waiting for your vote'}
        </Tile>
        <Tile to="/juror/evidence" icon="folder" title="Exhibit locker">{exhibits.length} exhibits admitted</Tile>
        <Tile to="/juror/timeline" icon="timeline" title="Timeline">{timeline.length ? `${timeline.length} events so far` : 'Start building the timeline together'}</Tile>
        <Tile to="/juror/bulletin" icon="mail" title="Messages from home" highlight={unread > 0}>
          {unread ? `${unread} new message${unread === 1 ? '' : 's'}` : 'No new messages'}
        </Tile>
        <Tile to="/juror/requests" icon="bell" title="Requests">{activeRequests ? `${activeRequests} in progress` : 'Breaks, meals, supplies'}</Tile>
      </div>

      <Card className="mt-8 bg-surface-2 p-6">
        <h2 className="mb-2 font-bold">A gentle reminder</h2>
        <p className="text-muted">
          Deliberation is tiring. It’s fine to ask the bailiff for a break at any time.
          Please don’t research the case or discuss it outside this room.
        </p>
      </Card>
    </div>
  )
}
