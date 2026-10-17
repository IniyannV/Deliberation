import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { load, store } from '../../lib/storage'
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
                <Link to={href} className="pressable inline-flex items-center gap-2 rounded-full bg-fill px-3.5 py-1.5 font-medium text-accent hover:bg-fill-strong">
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

/** Right-click menu for a timeline card. */
function CardMenu({ menu, onEdit, onDelete, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    ref.current?.querySelector('button')?.focus()
    const close = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    const key = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', key)
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', key)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])
  const x = Math.min(menu.x, window.innerWidth - 240)
  const y = Math.min(menu.y, window.innerHeight - 150)
  return (
    <div ref={ref} role="menu" aria-label={`Options for ${menu.ev.label}`} className="material materialize fixed z-50 w-56 origin-top-left overflow-hidden rounded-xl p-1.5" style={{ left: x, top: y }}>
      <p className="truncate px-2.5 pt-1 pb-1.5 text-xs font-semibold text-muted">{menu.ev.label}</p>
      <button type="button" role="menuitem" onClick={onEdit} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left hover:bg-accent hover:text-accent-ink focus:bg-accent focus:text-accent-ink focus:outline-none">
        <Icon name="edit" size={18} /> Edit event
      </button>
      <button type="button" role="menuitem" onClick={onDelete} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-danger hover:bg-danger hover:text-white focus:bg-danger focus:text-white focus:outline-none">
        <Icon name="trash" size={18} /> Delete event…
      </button>
    </div>
  )
}

export default function TimelinePage() {
  const timeline = useLive((s) => s.timeline)
  const exhibits = useLive((s) => s.exhibits)
  const emit = useLive((s) => s.emit)
  const location = useLocation()
  const navigate = useNavigate()
  const [zoom, setZoom] = useState(1)
  const [mode, setMode] = useState(() => load('timelineMode', 'lanes'))
  const [selectedId, setSelectedId] = useState(null)
  const [editor, setEditor] = useState(null) // { initial, defaultAt } | null
  const [menu, setMenu] = useState(null) // { ev, x, y } | null
  const [deleting, setDeleting] = useState(null) // event to confirm

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
      await emit('timeline:delete', { id: deleting.id })
      if (selectedId === deleting.id) setSelectedId(null)
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
    setDeleting(null)
  }

  const changeMode = (m) => { setMode(m); store('timelineMode', m) }
  const zoomNum = zoom === 'fit' ? 1 : zoom

  return (
    <div>
      <PageHeader
        title="Timeline"
        subtitle="A shared timeline for the whole jury. Changes appear on every screen and the room display."
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
        <div className="flex flex-wrap items-center gap-2" data-tour="timeline-controls">
          <Segmented label="Layout" value={mode} onChange={changeMode} options={[{ value: 'lanes', label: 'Three lanes' }, { value: 'single', label: 'One line' }]} />
          <Segmented label="Zoom" value={zoom === 'fit' ? 'fit' : 'manual'} onChange={(v) => setZoom(v === 'fit' ? 'fit' : 1)} options={[{ value: 'fit', label: 'Compact' }, { value: 'manual', label: 'Detailed' }]} />
          <IconButton icon="minus" label="Zoom out" onClick={() => setZoom(Math.max(0, +(zoomNum - 0.25).toFixed(2)))} />
          <IconButton icon="plus" label="Zoom in" onClick={() => setZoom(Math.min(3, +(zoomNum + 0.25).toFixed(2)))} />
        </div>
      </div>

      {timeline.length ? (
        <>
          <Card className="mb-2 py-2" data-tour="timeline-board">
            <Timeline
              events={timeline}
              zoom={zoom}
              mode={mode}
              selectedId={selectedId}
              onSelect={(ev) => setSelectedId(ev.id === selectedId ? null : ev.id)}
              onMove={move}
              onCreateAt={(at) => setEditor({ initial: null, defaultAt: at })}
              onCardMenu={(ev, x, y) => setMenu({ ev, x, y })}
            />
          </Card>
          <p className="mb-6 text-sm text-muted">
            Drag a card sideways to change its time · Double-click empty space to add an event there · Right-click a card to edit or delete it
          </p>
        </>
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
          onDelete={() => setDeleting(selected)}
          onClose={() => setSelectedId(null)}
        />
      )}

      {menu && (
        <CardMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onEdit={() => { setEditor({ initial: menu.ev }); setMenu(null) }}
          onDelete={() => { setDeleting(menu.ev); setMenu(null) }}
        />
      )}

      {editor && (
        <EventEditor
          open
          initial={editor.initial}
          defaultAt={editor.defaultAt ?? (latest || undefined)}
          onClose={() => setEditor(null)}
          onSaved={(ev) => setSelectedId(ev.id)}
        />
      )}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this event?"
        footer={<>
          <Button variant="ghost" onClick={() => setDeleting(null)}>Keep it</Button>
          <Button variant="danger" onClick={remove}>Delete for everyone</Button>
        </>}
      >
        <p>“{deleting?.label}” will be removed from the timeline on every juror’s screen.</p>
      </Modal>
    </div>
  )
}
