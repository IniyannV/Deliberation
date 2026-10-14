import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { EVENT_TYPES, fmtDateTime } from '../../lib/format'
import { Badge, Button, Card, EmptyState, IconButton, Modal, PageHeader, Segmented, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import Timeline, { TYPE_STYLE } from './Timeline'
import EventEditor from './EventEditor'

function EventDetail({ ev, exhibitsById, onEdit, onDelete, onClose }) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={cx('font-semibold', TYPE_STYLE[ev.type].text)}>
            {EVENT_TYPES.find((t) => t.id === ev.type)?.label} · {fmtDateTime(ev.at)}
          </p>
          <h2 className="mt-1 text-2xl font-bold">{ev.label}</h2>
        </div>
        <div className="flex gap-1">
          <Button size="sm" icon="edit" onClick={onEdit}>Edit</Button>
          <Button size="sm" variant="danger" icon="trash" onClick={onDelete}>Delete</Button>
          <IconButton icon="x" label="Close details" onClick={onClose} />
        </div>
      </div>
      {ev.description && <p className="mt-4 max-w-3xl whitespace-pre-wrap">{ev.description}</p>}
      {ev.attachments?.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {ev.attachments.map((a, i) => {
            const ex = exhibitsById[a.kind === 'exhibit' ? a.exhibitId : a.transcriptId]
            if (!ex) return <li key={i}><Badge>Removed exhibit</Badge></li>
            const href = a.kind === 'exhibit' ? `/juror/evidence/${ex.id}` : `/juror/review?t=${ex.id}&line=${a.fromLine}`
            return (
              <li key={i}>
                <Link to={href} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 hover:border-accent hover:text-accent">
                  <Icon name={a.kind === 'exhibit' ? 'file' : 'text'} size={16} />
                  <b>{ex.number}</b>
                  <span className="text-muted">{a.kind === 'excerpt' ? `lines ${a.fromLine}${a.toLine !== a.fromLine ? `–${a.toLine}` : ''}` : ex.title}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export default function TimelinePage() {
  const timeline = useLive((s) => s.timeline)
  const exhibits = useLive((s) => s.exhibits)
  const emit = useLive((s) => s.emit)
  const location = useLocation()
  const navigate = useNavigate()
  const [zoom, setZoom] = useState(1)
  const [selectedId, setSelectedId] = useState(null)
  const [editor, setEditor] = useState(null) // { initial } | null
  const [confirmDelete, setConfirmDelete] = useState(false)

  const exhibitsById = Object.fromEntries(exhibits.map((e) => [e.id, e]))
  const selected = timeline.find((e) => e.id === selectedId)
  const latest = timeline.reduce((m, e) => (e.at > m ? e.at : m), '')

  // A draft handed over from side-by-side review ("Add to timeline").
  useEffect(() => {
    if (location.state?.draft) {
      setEditor({ initial: location.state.draft })
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state, location.pathname, navigate])

  async function move(ev, at) {
    try {
      await emit('timeline:move', { id: ev.id, version: ev.version, at })
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  async function remove() {
    try {
      await emit('timeline:delete', { id: selectedId })
      setSelectedId(null)
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
    setConfirmDelete(false)
  }

  const zoomNum = zoom === 'fit' ? 1 : zoom

  return (
    <div>
      <PageHeader
        title="Timeline"
        subtitle="A shared timeline for the whole jury. Changes appear on every screen and the room display. Drag a card sideways to change its time."
        actions={<Button variant="primary" icon="plus" onClick={() => setEditor({ initial: null })}>Add event</Button>}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-4" aria-label="Legend">
          {EVENT_TYPES.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <span className={cx('h-3 w-3 rounded-full', TYPE_STYLE[t.id].dot)} /> {t.label}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <Segmented label="Zoom" value={zoom === 'fit' ? 'fit' : 'manual'} onChange={(v) => setZoom(v === 'fit' ? 'fit' : 1)} options={[{ value: 'fit', label: 'Fit to screen' }, { value: 'manual', label: 'Detailed' }]} />
          <IconButton icon="minus" label="Zoom out" onClick={() => setZoom(Math.max(0.3, +(zoomNum - 0.25).toFixed(2)))} />
          <IconButton icon="plus" label="Zoom in" onClick={() => setZoom(Math.min(3, +(zoomNum + 0.25).toFixed(2)))} />
        </div>
      </div>

      {timeline.length ? (
        <Card className="mb-6 py-2">
          <Timeline events={timeline} zoom={zoom} selectedId={selectedId} onSelect={(ev) => setSelectedId(ev.id === selectedId ? null : ev.id)} onMove={move} />
        </Card>
      ) : (
        <div className="mb-6">
          <EmptyState icon="timeline" title="The timeline is empty">
            Add the first event, or select transcript lines in side-by-side review and choose “Add to timeline”.
          </EmptyState>
        </div>
      )}

      {selected && (
        <EventDetail
          ev={selected}
          exhibitsById={exhibitsById}
          onEdit={() => setEditor({ initial: selected })}
          onDelete={() => setConfirmDelete(true)}
          onClose={() => setSelectedId(null)}
        />
      )}

      {editor && (
        <EventEditor
          open
          initial={editor.initial}
          defaultAt={latest || undefined}
          onClose={() => setEditor(null)}
          onSaved={(ev) => setSelectedId(ev.id)}
        />
      )}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this event?"
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep it</Button>
          <Button variant="danger" onClick={remove}>Delete for everyone</Button>
        </>}
      >
        <p>“{selected?.label}” will be removed from the timeline on every juror’s screen.</p>
      </Modal>
    </div>
  )
}
