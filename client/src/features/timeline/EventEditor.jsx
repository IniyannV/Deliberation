import { useState } from 'react'
import { useLive } from '../../store/live'
import { EVENT_TYPES, fromLocalInput, toLocalInput } from '../../lib/format'
import { Button, ErrorText, Field, Input, Modal, Select, Textarea, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useExhibit } from '../evidence/useExhibit'
import { TYPE_STYLE } from './Timeline'

function ExcerptPreview({ transcriptId, fromLine, toLine }) {
  const { exhibit } = useExhibit(transcriptId)
  if (!exhibit?.lines) return null
  const lines = exhibit.lines.filter((l) => l.n >= fromLine && l.n <= toLine).slice(0, 4)
  return (
    <blockquote className="mt-1 border-l-2 border-line pl-3 text-sm text-muted">
      {lines.map((l) => <p key={l.n}>{l.speaker && <b>{l.speaker}: </b>}{l.text}</p>)}
      {toLine - fromLine >= 4 && <p>…</p>}
    </blockquote>
  )
}

/** Create or edit a timeline event. `initial` may be an existing event or a draft. */
export default function EventEditor({ open, initial, defaultAt, onClose, onSaved }) {
  const exhibits = useLive((s) => s.exhibits)
  const emit = useLive((s) => s.emit)
  const editing = !!initial?.id
  const [form, setForm] = useState(() => ({
    label: initial?.label ?? '',
    at: toLocalInput(initial?.at ?? defaultAt ?? new Date().toISOString()),
    type: initial?.type ?? 'testimony',
    description: initial?.description ?? '',
    attachments: initial?.attachments ?? [],
  }))
  const [excerpt, setExcerpt] = useState({ transcriptId: '', fromLine: '', toLine: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }))
  const byId = Object.fromEntries(exhibits.map((e) => [e.id, e]))
  const attachedExhibitIds = form.attachments.filter((a) => a.kind === 'exhibit').map((a) => a.exhibitId)

  const toggleExhibit = (id) =>
    setForm((f) => ({
      ...f,
      attachments: attachedExhibitIds.includes(id)
        ? f.attachments.filter((a) => !(a.kind === 'exhibit' && a.exhibitId === id))
        : [...f.attachments, { kind: 'exhibit', exhibitId: id }],
    }))

  const addExcerpt = () => {
    const fromLine = Number(excerpt.fromLine)
    const toLine = Number(excerpt.toLine || excerpt.fromLine)
    if (!excerpt.transcriptId || !fromLine) return
    setForm((f) => ({ ...f, attachments: [...f.attachments, { kind: 'excerpt', transcriptId: excerpt.transcriptId, fromLine, toLine: Math.max(fromLine, toLine) }] }))
    setExcerpt({ transcriptId: '', fromLine: '', toLine: '' })
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = { ...form, at: fromLocalInput(form.at) }
      const res = editing
        ? await emit('timeline:update', { ...payload, id: initial.id, version: initial.version })
        : await emit('timeline:create', payload)
      onSaved?.(res.event)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={editing ? 'Edit event' : 'Add an event to the timeline'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="event-form" disabled={busy}>{editing ? 'Save changes' : 'Add event'}</Button>
      </>}
    >
      <form id="event-form" onSubmit={save} className="flex flex-col gap-5">
        <div className="grid grid-cols-[1fr_auto] gap-4">
          <Field label="What happened">
            {(id) => <Input id={id} value={form.label} onChange={set('label')} maxLength={120} required placeholder="e.g. Alarm triggered at the store" />}
          </Field>
          <Field label="Date and time">
            {(id) => <Input id={id} type="datetime-local" value={form.at} onChange={set('at')} required />}
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 font-semibold">Kind of event</legend>
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES.map((t) => (
              <label key={t.id} className={cx('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2', form.type === t.id ? 'border-accent bg-accent-soft' : 'border-line')}>
                <input type="radio" name="type" value={t.id} checked={form.type === t.id} onChange={set('type')} className="sr-only" />
                <span className={cx('h-3 w-3 rounded-full', TYPE_STYLE[t.id].dot)} />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="Notes (optional)">
          {(id) => <Textarea id={id} value={form.description} onChange={set('description')} maxLength={2000} />}
        </Field>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1.5 font-semibold">Attach exhibits</legend>
          <div className="flex flex-wrap gap-2">
            {exhibits.filter((x) => x.type !== 'transcript').map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={attachedExhibitIds.includes(x.id)}
                onClick={() => toggleExhibit(x.id)}
                className={cx('rounded-full border px-3 py-1 text-sm', attachedExhibitIds.includes(x.id) ? 'border-accent bg-accent-soft font-semibold text-accent' : 'border-line hover:bg-surface-2')}
                title={x.title}
              >
                {attachedExhibitIds.includes(x.id) && <Icon name="check" size={14} className="mr-1 inline" />}
                {x.number}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1.5 font-semibold">Transcript excerpts</legend>
          {form.attachments.map((a, i) => a.kind === 'excerpt' && (
            <div key={i} className="rounded-lg border border-line p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{byId[a.transcriptId]?.number}, lines {a.fromLine}{a.toLine !== a.fromLine ? `–${a.toLine}` : ''}</span>
                <Button size="sm" variant="ghost" icon="x" onClick={() => setForm((f) => ({ ...f, attachments: f.attachments.filter((_, j) => j !== i) }))}>Remove</Button>
              </div>
              <ExcerptPreview {...a} />
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2">
            <Select value={excerpt.transcriptId} onChange={(e) => setExcerpt({ ...excerpt, transcriptId: e.target.value })} className="w-auto flex-1" aria-label="Transcript">
              <option value="">Choose a transcript…</option>
              {exhibits.filter((x) => x.type === 'transcript').map((x) => <option key={x.id} value={x.id}>{x.number}: {x.title}</option>)}
            </Select>
            <Input type="number" min={1} value={excerpt.fromLine} onChange={(e) => setExcerpt({ ...excerpt, fromLine: e.target.value })} placeholder="From line" className="w-32" aria-label="From line" />
            <Input type="number" min={1} value={excerpt.toLine} onChange={(e) => setExcerpt({ ...excerpt, toLine: e.target.value })} placeholder="To line" className="w-32" aria-label="To line" />
            <Button icon="plus" onClick={addExcerpt} disabled={!excerpt.transcriptId || !excerpt.fromLine}>Add</Button>
          </div>
        </fieldset>

        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  )
}
