import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLive } from '../../store/live'
import { PARTY_LABEL, TYPE_LABEL, fmtBytes, fmtCalendarDate } from '../../lib/format'
import { Badge, Button, Card, Spinner } from '../../components/ui'
import { Icon } from '../../components/icons'
import ExhibitViewer from './ExhibitViewer'

export default function ExhibitPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const exhibits = useLive((s) => s.exhibits)
  const loaded = useLive((s) => s.exhibitsLoaded)
  const exhibit = exhibits.find((e) => e.id === id)

  if (!exhibit) return loaded ? <p className="text-muted">This exhibit is no longer available. <Link className="text-accent underline" to="/juror/evidence">Back to the locker</Link></p> : <Spinner />

  const reviewHref = exhibit.type === 'transcript' ? `/juror/review?t=${exhibit.id}` : `/juror/review?ex=${exhibit.id}`

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/juror/evidence" className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Back to exhibit locker">
            <Icon name="chevronLeft" />
          </Link>
          <Badge tone="accent" className="text-base">{exhibit.number}</Badge>
          <h1 className="text-2xl font-bold">{exhibit.title}</h1>
        </div>
        <Button icon="columns" onClick={() => navigate(reviewHref)}>Open side by side</Button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_18rem] gap-5">
        <Card className="min-h-0 overflow-hidden">
          <ExhibitViewer exhibitId={exhibit.id} focusLine={Number(params.get('line')) || undefined} onOpenExhibit={(eid) => navigate(`/juror/evidence/${eid}`)} />
        </Card>
        <Card className="h-fit p-5">
          <dl className="flex flex-col gap-3">
            {[
              ['Type', TYPE_LABEL[exhibit.type]],
              ['Introduced by', PARTY_LABEL[exhibit.party]],
              ['Admitted', fmtCalendarDate(exhibit.dateAdmitted)],
              ['File size', fmtBytes(exhibit.size)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm text-muted">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
            {exhibit.description && (
              <div>
                <dt className="text-sm text-muted">Description</dt>
                <dd>{exhibit.description}</dd>
              </div>
            )}
          </dl>
        </Card>
      </div>
    </div>
  )
}
