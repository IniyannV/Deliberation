import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLive } from '../../store/live'
import { PARTY_LABEL, TYPE_LABEL, fmtBytes, fmtCalendarDate } from '../../lib/format'
import { Badge, Button, Card, Spinner } from '../../components/ui'
import { Icon } from '../../components/icons'
import ExhibitViewer from './ExhibitViewer'
import Enlargeable from './Enlargeable'

export default function ExhibitPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const exhibits = useLive((s) => s.exhibits)
  const loaded = useLive((s) => s.exhibitsLoaded)
  const [enlarged, setEnlarged] = useState(false)
  const exhibit = exhibits.find((e) => e.id === id)

  if (!exhibit) return loaded ? <p className="text-muted">This exhibit is no longer available. <Link className="text-accent underline" to="/juror/evidence">Back to the locker</Link></p> : <Spinner />

  // The exhibit you were just on stays on the left; pick something to compare on the right.
  const reviewHref = `/juror/review?t=${exhibit.id}`

  return (
    <div className="flex h-[calc(100dvh-var(--page-chrome,4rem))] flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/juror/evidence" className="pressable -ml-2 flex items-center rounded-full py-1.5 pr-3 pl-1 font-medium text-accent hover:bg-fill" aria-label="Back to exhibit locker">
            <Icon name="chevronLeft" size={24} strokeWidth={2.2} /> Locker
          </Link>
          <Badge tone="accent" className="text-base">{exhibit.number}</Badge>
          <h1 className="text-2xl font-bold">{exhibit.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button icon="maximize" onClick={() => setEnlarged(true)}>Full screen</Button>
          <Button icon="columns" onClick={() => navigate(reviewHref)}>Open side by side</Button>
        </div>
      </div>
      {/* Narrow screens (iPad portrait) give the exhibit the full width; details go in one line. */}
      <p className="-mt-2 mb-3 text-muted lg:hidden">
        {TYPE_LABEL[exhibit.type]} · {PARTY_LABEL[exhibit.party]} · Admitted {fmtCalendarDate(exhibit.dateAdmitted)}
        {exhibit.description && <> · {exhibit.description}</>}
      </p>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[1fr_18rem]">
        <Card className="min-h-0 overflow-hidden">
          <Enlargeable exhibit={exhibit} enlarged={enlarged} onExit={() => setEnlarged(false)} className="h-full">
            <ExhibitViewer exhibitId={exhibit.id} focusLine={Number(params.get('line')) || undefined} onOpenExhibit={(eid) => navigate(`/juror/evidence/${eid}`)} />
          </Enlargeable>
        </Card>
        <Card className="hidden h-fit p-5 lg:block">
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
