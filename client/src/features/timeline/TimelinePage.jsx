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

/** An event's details, shown in a popup when its card is tapped. */
function EventDetail({ ev, exhibitsById, scope, onEdit, onDelete, onCopy, onClose }) {
  const shown = useRef(ev)
  if (ev) shown.current = ev
  const e = shown.current // keep the content while the popup animates out
  return (
    <Modal
      open={!!ev}
      onClose={onClose}
      wide
      title={e?.label ?? ''}
      footer={<>
        <Button variant="danger" icon="trash" onClick={onDelete}>Delete</Button>
        <Button icon="plus" onClick={onCopy} className="mr-auto order-first">
          {scope === 'personal' ? 'Copy to shared timeline' : 'Copy to my timeline'}
        </Button>
        <Button variant="primary" icon="edit" onClick={onEdit}>Edit</Button>
      </>}
    >
      {e && (
        <>
          <p className={cx('-mt-2 font-semibold', TYPE_STYLE[e.type].text)}>
            {EVENT_TYPES.find((t) => t.id === e.type)?.label} · {fmtDateTime(e.at)}
          </p>
          {e.description ? <p className="mt-3 whitespace-pre-wrap">{e.description}</p> : <p className="mt-3 text-muted">No description.</p>}
          {e.attachments?.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {e.attachments.map((a, i) => {
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
        </>
      )}
    </Modal>
  )
}

/** Right-click (or long-press) menu for a timeline card. */
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

const SCOPES = [
  { value: 'shared', label: 'Shared with the jury' },
  { value: 'personal', label: 'My timeline' },
]

export default function TimelinePage() {
  const [scope, setScope] = useState(() => load('timelineScope', 'shared'))
  const shared = useLive((s) => s.timeline)
  const personal = useLive((s) => s.personal.timeline)
  const timeline = (scope === 'personal' ? personal : shared) ?? []
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
  // New events default to the latest time on this timeline (or the shared one, while this is empty).
  const latest = (timeline.length ? timeline : shared).reduce((m, e) => (e.at > m ? e.at : m), '')

  // A draft handed over from side-by-side review ("Add to timeline").
  useEffect(() => {
    if (location.state?.draft) {
      setEditor({ initial: location.state.draft })
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state, location.pathname, navigate])

  async function move(ev, at) {
    try {
      await emit('timeline:move', { id: ev.id, version: ev.version, at, scope })
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  async function remove() {
    try {
      await emit('timeline:delete', { id: deleting.id, scope })
      if (selectedId === deleting.id) setSelectedId(null)
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
    setDeleting(null)
  }

  /** Put a copy of an event on the other timeline. */
  async function copy(ev) {
    const to = scope === 'personal' ? 'shared' : 'personal'
    try {
      const { label, at, type, description, attachments } = ev
      await emit('timeline:create', { label, at, type, description, attachments, scope: to })
      toast(to === 'personal' ? `Copied “${label}” to your timeline.` : `Copied “${label}” to the shared timeline. Every juror can see it now.`)
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  const changeMode = (m) => { setMode(m); store('timelineMode', m) }
  const changeScope = (v) => { setScope(v); store('timelineScope', v); setSelectedId(null); setMenu(null) }
  const zoomNum = zoom === 'fit' ? 1 : zoom

  return (
    <div>
      <PageHeader
        title="Timeline"
        subtitle={scope === 'personal'
          ? 'Your own timeline. Only you can see it, on any device you sign in to.'
          : 'A shared timeline for the whole jury. Changes appear on every screen and the room display.'}
        actions={<Button variant="primary" icon="plus" onClick={() => setEditor({ initial: null })}>Add event</Button>}
      />

      <Segmented
        label="Which timeline"
        value={scope}
        onChange={changeScope}
        options={SCOPES.map((o) => ({ ...o, label: `${o.label} (${((o.value === 'personal' ? personal : shared) ?? []).length})` }))}
        className="mb-4"
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
            Tap a card for details · Drag it sideways to change its time · Double-click empty space to add an event there · Right-click or long-press a card to edit or delete it
          </p>
        </>
      ) : (
        <div className="mb-6" data-tour="timeline-board">
          <EmptyState icon="timeline" title={scope === 'personal' ? 'Your timeline is empty' : 'The timeline is empty'}>
            Add the first event, or select transcript lines in side-by-side review and choose “Add to timeline”.
            {scope === 'personal' && ' You can also open any event on the shared timeline and copy it here.'}
          </EmptyState>
        </div>
      )}

      <EventDetail
        ev={selected}
        exhibitsById={exhibitsById}
        scope={scope}
        onCopy={() => { copy(selected); setSelectedId(null) }}
        onEdit={() => { setEditor({ initial: selected }); setSelectedId(null) }}
        onDelete={() => { setDeleting(selected); setSelectedId(null) }}
        onClose={() => setSelectedId(null)}
      />

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
          scope={scope}
          initial={editor.initial}
          defaultAt={editor.defaultAt ?? (latest || undefined)}
          onClose={() => setEditor(null)}
        />
      )}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this event?"
        footer={<>
          <Button variant="ghost" onClick={() => setDeleting(null)}>Keep it</Button>
          <Button variant="danger" onClick={remove}>{scope === 'personal' ? 'Delete' : 'Delete for everyone'}</Button>
        </>}
      >
        <p>
          {scope === 'personal'
            ? `“${deleting?.label}” will be removed from your timeline.`
            : `“${deleting?.label}” will be removed from the timeline on every juror’s screen.`}
        </p>
      </Modal>
    </div>
  )
}
