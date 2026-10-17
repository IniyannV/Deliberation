import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { load, store } from '../../lib/storage'
import { useLongPress } from '../../lib/touch'
import { Button, Segmented, Textarea, cx } from '../../components/ui'
import { Icon } from '../../components/icons'

/*
 * Image exhibit with pinned notes. Right-click (or long-press on an iPad)
 * anywhere on the image to pin a note there, and drag a pin to move it.
 * Notes are shared with the whole jury (like transcript links) and, as
 * deliberation content, are never written to the audit log.
 * Positions are stored as fractions of the image, so pins stay put at any zoom.
 */

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const DEFAULT_SIZE = { w: 288, h: 0 } // h 0: as tall as the content

/**
 * A floating note card beside a pin. Drag the grabber to move it anywhere
 * (even off the image) and the corner to resize it; the size is remembered.
 */
function NoteCard({ x, y, label, children, onClose }) {
  const ref = useRef(null)
  const [offset, setOffset] = useState(null) // px from the pin, measured on open
  const [size, setSize] = useState(() => load('noteSize', DEFAULT_SIZE))

  // Open beside the pin, on whichever side has room.
  useLayoutEffect(() => {
    const el = ref.current
    setOffset({ dx: x > 0.6 ? -(el.offsetWidth + 14) : 14, dy: y > 0.6 ? -el.offsetHeight : 0 })
    // Only on open: later moves are the juror's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    const key = (e) => { if (e.key === 'Escape') onClose() }
    // Defer so the opening click or long-press doesn't immediately close it.
    const id = setTimeout(() => window.addEventListener('pointerdown', close))
    window.addEventListener('keydown', key)
    return () => {
      clearTimeout(id)
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', key)
    }
  }, [onClose])

  const track = (kind) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    const x0 = e.clientX
    const y0 = e.clientY
    const from = { ...offset }
    const box = { w: ref.current.offsetWidth, h: ref.current.offsetHeight }
    let resized = null
    const move = (ev) => {
      const dx = ev.clientX - x0
      const dy = ev.clientY - y0
      if (kind === 'move') setOffset({ dx: from.dx + dx, dy: from.dy + dy })
      else setSize((resized = { w: clamp(box.w + dx, 220, 720), h: clamp(box.h + dy, 120, 720) }))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (resized) store('noteSize', resized)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className="material materialize absolute z-20 flex flex-col rounded-2xl text-left"
      style={{
        left: `calc(${x * 100}% + ${offset?.dx ?? 0}px)`,
        top: `calc(${y * 100}% + ${offset?.dy ?? 0}px)`,
        width: size.w,
        height: size.h || undefined,
        maxHeight: size.h ? undefined : 480,
        visibility: offset ? 'visible' : 'hidden',
      }}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div
        onPointerDown={track('move')}
        className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        title="Drag to move"
        aria-hidden
      >
        <span className="h-1 w-9 rounded-full bg-muted/40" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3 scrollbar-thin">{children}</div>
      <div
        onPointerDown={track('resize')}
        className="absolute right-0 bottom-0 flex h-7 w-7 cursor-nwse-resize touch-none items-end justify-end p-1.5 text-muted/60"
        title="Drag to resize"
        aria-hidden
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 1L1 9M9 5L5 9" /></svg>
      </div>
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
  const [moving, setMoving] = useState(null) // { id, x, y } while a pin is dragged or saving
  const justDragged = useRef(false)
  const box = useRef(null)
  const img = useRef(null)
  const [boxH, setBoxH] = useState(600)

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setBoxH(e.contentRect.height))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])

  const toImage = (clientX, clientY) => {
    const r = img.current.getBoundingClientRect()
    return { x: clamp01((clientX - r.left) / r.width), y: clamp01((clientY - r.top) / r.height) }
  }

  const pinMenu = useLongPress((clientX, clientY) => {
    setShowNotes(true)
    setOpenId(null)
    setDraft({ ...toImage(clientX, clientY), text: '' })
  })

  async function run(event, payload, done) {
    try {
      await emit(event, payload)
      done?.()
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  // Drag a pin to move it. A press without movement is a tap and opens the note.
  function pinDown(e, note) {
    if (e.button !== 0) return
    e.stopPropagation()
    const x0 = e.clientX
    const y0 = e.clientY
    let pos = null
    justDragged.current = false
    const move = (ev) => {
      if (!pos && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return
      pos = toImage(ev.clientX, ev.clientY)
      setMoving({ id: note.id, ...pos })
    }
    const up = async () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!pos) return
      justDragged.current = true
      await run('note:move', { id: note.id, ...pos })
      setMoving(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const placed = notes.map((n) => (moving?.id === n.id ? { ...n, x: moving.x, y: moving.y } : n))
  const open = placed.find((n) => n.id === openId)
  const number = (id) => notes.findIndex((n) => n.id === id) + 1

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <p className="flex items-center gap-2 text-sm text-muted"><Icon name="note" size={16} /> Right-click or long-press the image to pin a note · drag a pin to move it</p>
        <div className="flex items-center gap-2">
          {notes.length > 0 && (
            <label className="flex items-center gap-2 text-sm font-medium">
              Notes ({notes.length})
              <input type="checkbox" role="switch" checked={showNotes} onChange={(e) => setShowNotes(e.target.checked)} className="switch scale-90" />
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
            {...pinMenu}
            className={cx('no-callout block', mode === 'fit' ? 'max-w-full' : 'max-w-none')}
            style={mode === 'fit' ? { maxHeight: Math.max(200, boxH - 32) } : undefined}
            draggable={false}
          />

          {showNotes && placed.map((n) => (
            <button
              key={n.id}
              type="button"
              onPointerDown={(e) => pinDown(e, n)}
              onClick={() => {
                if (justDragged.current) { justDragged.current = false; return }
                setOpenId(n.id === openId ? null : n.id); setEditText(null); setDraft(null)
              }}
              className={cx(
                'no-callout absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-full border-2 border-white text-sm font-bold shadow-md transition-[scale,box-shadow] duration-200 active:cursor-grabbing',
                n.id === openId ? 'bg-accent-strong text-accent-ink' : 'bg-accent text-accent-ink',
                moving?.id === n.id && 'z-10 scale-125 shadow-[var(--shadow-float)]',
              )}
              style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%` }}
              aria-label={`Note ${number(n.id)}: ${n.text}`}
            >
              {number(n.id)}
            </button>
          ))}

          {draft && (
            <>
              <span className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-warn shadow" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }} aria-hidden />
              <NoteCard x={draft.x} y={draft.y} label={`New note on ${exhibit.number}`} onClose={() => setDraft(null)}>
                <form onSubmit={(e) => { e.preventDefault(); run('note:create', { exhibitId: exhibit.id, x: draft.x, y: draft.y, text: draft.text }, () => setDraft(null)) }}>
                  <p className="mb-2 text-sm font-semibold">New note on {exhibit.number}</p>
                  <Textarea autoFocus value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} maxLength={500} className="min-h-20 text-base" placeholder="What should the jury notice here?" />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
                    <Button size="sm" variant="primary" type="submit" disabled={!draft.text.trim()}>Pin note</Button>
                  </div>
                </form>
              </NoteCard>
            </>
          )}

          {open && showNotes && (
            <NoteCard key={open.id} x={open.x} y={open.y} label={`Note ${number(open.id)}`} onClose={() => { setOpenId(null); setEditText(null) }}>
              {editText === null ? (
                <>
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
            </NoteCard>
          )}
        </div>
      </div>
    </div>
  )
}
