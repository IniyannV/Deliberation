import { useEffect, useRef, useState } from 'react'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { Button, Segmented, Textarea, cx } from '../../components/ui'
import { Icon } from '../../components/icons'

/*
 * Image exhibit with pinned notes. Right-click anywhere on the image to pin
 * a note there. Notes are shared with the whole jury (like transcript links)
 * and, as deliberation content, are never written to the audit log.
 * Positions are stored as fractions of the image, so pins stay put at any zoom.
 */

function Popover({ x, y, children, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    const key = (e) => { if (e.key === 'Escape') onClose() }
    // Defer so the opening click/right-click doesn't immediately close it.
    const id = setTimeout(() => window.addEventListener('pointerdown', close))
    window.addEventListener('keydown', key)
    return () => {
      clearTimeout(id)
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', key)
    }
  }, [onClose])
  return (
    <div
      ref={ref}
      className="absolute z-20 w-72 rounded-xl border border-line bg-surface p-3 text-left shadow-xl"
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: `translate(${x > 0.6 ? 'calc(-100% - 14px)' : '14px'}, ${y > 0.6 ? '-100%' : '0'})` }}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

export default function ImageViewer({ exhibit, url, title }) {
  const notes = useLive((s) => s.notes).filter((n) => n.exhibitId === exhibit.id)
  const emit = useLive((s) => s.emit)
  const [mode, setMode] = useState('fit')
  const [showNotes, setShowNotes] = useState(true)
  const [draft, setDraft] = useState(null) // { x, y, text } for a new note
  const [openId, setOpenId] = useState(null)
  const [editText, setEditText] = useState(null) // string while editing the open note
  const box = useRef(null)
  const img = useRef(null)
  const [boxH, setBoxH] = useState(600)

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setBoxH(e.contentRect.height))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])

  function contextMenu(e) {
    e.preventDefault()
    const r = img.current.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    setShowNotes(true)
    setOpenId(null)
    setDraft({ x, y, text: '' })
  }

  async function run(event, payload, done) {
    try {
      await emit(event, payload)
      done?.()
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  const open = notes.find((n) => n.id === openId)
  const number = (id) => notes.findIndex((n) => n.id === id) + 1

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-1.5">
        <p className="flex items-center gap-2 text-sm text-muted"><Icon name="note" size={16} /> Right-click the image to pin a note for the jury</p>
        <div className="flex items-center gap-2">
          {notes.length > 0 && (
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={showNotes} onChange={(e) => setShowNotes(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
              Notes ({notes.length})
            </label>
          )}
          <Segmented label="Image size" value={mode} onChange={setMode} options={[{ value: 'fit', label: 'Fit' }, { value: 'full', label: 'Actual size' }]} />
        </div>
      </div>
      <div ref={box} className="min-h-0 flex-1 overflow-auto bg-surface-2 p-4 text-center scrollbar-thin">
        <div className="relative inline-block align-top">
          <img
            ref={img}
            src={url}
            alt={title}
            onContextMenu={contextMenu}
            className={cx('block', mode === 'fit' ? 'max-w-full' : 'max-w-none')}
            style={mode === 'fit' ? { maxHeight: Math.max(200, boxH - 32) } : undefined}
            draggable={false}
          />

          {showNotes && notes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => { setOpenId(n.id === openId ? null : n.id); setEditText(null); setDraft(null) }}
              className={cx('absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-sm font-bold shadow-md', n.id === openId ? 'bg-accent-strong text-accent-ink' : 'bg-accent text-accent-ink')}
              style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%` }}
              aria-label={`Note ${number(n.id)}: ${n.text}`}
            >
              {number(n.id)}
            </button>
          ))}

          {draft && (
            <>
              <span className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-warn shadow" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }} aria-hidden />
              <Popover x={draft.x} y={draft.y} onClose={() => setDraft(null)}>
                <form onSubmit={(e) => { e.preventDefault(); run('note:create', { exhibitId: exhibit.id, x: draft.x, y: draft.y, text: draft.text }, () => setDraft(null)) }}>
                  <p className="mb-2 text-sm font-semibold">New note on {exhibit.number}</p>
                  <Textarea autoFocus value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} maxLength={500} className="min-h-20 text-base" placeholder="What should the jury notice here?" />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
                    <Button size="sm" variant="primary" type="submit" disabled={!draft.text.trim()}>Pin note</Button>
                  </div>
                </form>
              </Popover>
            </>
          )}

          {open && showNotes && (
            <Popover x={open.x} y={open.y} onClose={() => { setOpenId(null); setEditText(null) }}>
              {editText === null ? (
                <>
                  <p className="mb-1 text-sm font-semibold text-muted">Note {number(open.id)}</p>
                  <p className="whitespace-pre-wrap">{open.text}</p>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditText(open.text)}>Edit</Button>
                    <Button size="sm" variant="danger" icon="trash" onClick={() => run('note:delete', { id: open.id }, () => setOpenId(null))}>Delete</Button>
                  </div>
                </>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); run('note:update', { id: open.id, text: editText }, () => setEditText(null)) }}>
                  <Textarea autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={500} className="min-h-20 text-base" />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditText(null)}>Cancel</Button>
                    <Button size="sm" variant="primary" type="submit" disabled={!editText.trim()}>Save</Button>
                  </div>
                </form>
              )}
            </Popover>
          )}
        </div>
      </div>
    </div>
  )
}
