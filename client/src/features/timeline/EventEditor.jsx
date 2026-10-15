import { useState } from 'react'
import { useLive } from '../../store/live'
import { EVENT_TYPES, fromLocalInput, toLocalInput } from '../../lib/format'
import { Button, ErrorText, Field, Input, Modal, Select, Textarea, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useExhibit } from '../evidence/useExhibit'
import { TYPE_STYLE } from './Timeline'

function ExcerptPreview({ transcriptId, fromLine, toLine, max = 4 }) {
  const { exhibit } = useExhibit(transcriptId)
  if (!exhibit?.lines) return null
  const lines = exhibit.lines.filter((l) => l.n >= fromLine && l.n <= toLine)
  return (
    <blockquote className="mt-1 border-l-2 border-line pl-3 text-sm text-muted">
      {lines.slice(0, max).map((l) => (
        <p key={l.n}><span className="mr-2 font-mono text-xs">{l.n}</span>{l.speaker && <b>{l.speaker}: </b>}{l.text}</p>
      ))}
      {lines.length > max && <p>… {lines.length - max} more line{lines.length - max === 1 ? '' : 's'}</p>}
    </blockquote>
  )
}

/** Checks a pending excerpt against the chosen transcript. Returns { error } or { fromLine, toLine }. */
function checkExcerpt(excerpt, transcript) {
  if (!excerpt.transcriptId) return { error: '' }
  if (!transcript?.lines) return { error: '' } // still loading
  const max = transcript.lines.length
  if (excerpt.fromLine === '') return { error: '' }
  const fromLine = Number(excerpt.fromLine)
  if (!Number.isInteger(fromLine) || fromLine < 1 || fromLine > max) return { error: `${transcript.number} has lines 1 to ${max}. Line ${excerpt.fromLine} doesn't exist.` }
  if (excerpt.toLine === '') return { fromLine, toLine: fromLine }
  const toLine = Number(excerpt.toLine)
  if (!Number.isInteger(toLine) || toLine > max) return { error: `${transcript.number} ends at line ${max}.` }
  if (toLine < fromLine) return { error: 'The “to” line must come after the “from” line.' }
  return { fromLine, toLine }
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
  const { exhibit: pendingTranscript } = useExhibit(excerpt.transcriptId || null)
  const pending = checkExcerpt(excerpt, pendingTranscript)
  const pendingValid = pending.fromLine !== undefined
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
    if (!pendingValid) return
    const { fromLine, toLine } = pending
    setForm((f) => ({ ...f, attachments: [...f.attachments, { kind: 'excerpt', transcriptId: excerpt.transcriptId, fromLine, toLine }] }))
    setExcerpt({ transcriptId: '', fromLine: '', toLine: '' })
  }
  const lineCount = pendingTranscript?.lines?.length

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
            <Input type="number" min={1} max={lineCount} value={excerpt.fromLine} onChange={(e) => setExcerpt({ ...excerpt, fromLine: e.target.value })} placeholder="From line" className="w-32" aria-label="From line" disabled={!excerpt.transcriptId} />
            <Input type="number" min={Number(excerpt.fromLine) || 1} max={lineCount} value={excerpt.toLine} onChange={(e) => setExcerpt({ ...excerpt, toLine: e.target.value })} placeholder="To (optional)" className="w-36" aria-label="To line" disabled={!excerpt.transcriptId} />
            <Button icon="plus" onClick={addExcerpt} disabled={!pendingValid}>Add excerpt</Button>
          </div>
          {excerpt.transcriptId && lineCount && !excerpt.fromLine && (
            <p className="text-sm text-muted">{pendingTranscript.number} has {lineCount} lines. Enter the first line to quote; leave “to” empty for a single line.</p>
          )}
          {pending.error && <p role="alert" className="text-sm font-semibold text-danger">{pending.error}</p>}
          {pendingValid && (
            <div className="rounded-lg border border-dashed border-accent/50 bg-accent-soft/40 p-3">
              <p className="text-sm font-semibold text-accent">Preview: {pendingTranscript.number}, line{pending.toLine !== pending.fromLine ? `s ${pending.fromLine}–${pending.toLine}` : ` ${pending.fromLine}`}</p>
              <ExcerptPreview transcriptId={excerpt.transcriptId} fromLine={pending.fromLine} toLine={pending.toLine} max={12} />
            </div>
          )}
        </fieldset>

        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  )
}
