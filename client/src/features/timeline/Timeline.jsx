import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/icons'
import { cx } from '../../components/ui'
import { fmtDateTime, fmtDay, fmtTime } from '../../lib/format'
import { LONG_PRESS_MS, LONG_PRESS_SLOP } from '../../lib/touch'
import { useUi } from '../../store/ui'
import { AXIS_H, buildAxis, cardSize, cardTop, fitZoom, laneLayout, snap, timeAtX } from './layout'

export const TYPE_STYLE = {
  testimony: { bar: 'bg-testimony', text: 'text-testimony', dot: 'bg-testimony' },
  physical: { bar: 'bg-physical', text: 'text-physical', dot: 'bg-physical' },
  document: { bar: 'bg-document', text: 'text-document', dot: 'bg-document' },
}

const NUDGE = { normal: 15 * 60e3, shift: 24 * 3600e3 }

/**
 * Shared horizontal timeline.
 *  zoom: number | 'fit'    mode: 'lanes' | 'single'
 *  onSelect(ev)  onMove(ev, iso)  onCreateAt(iso)  onCardMenu(ev, x, y)   (omit the last three for read-only)
 *  scrollRef: also given the horizontal scroller, for scrolling it from outside
 */
export default function Timeline({ events, zoom = 1, mode = 'lanes', selectedId, onSelect, onMove, onCreateAt, onCardMenu, scrollRef }) {
  const scroller = useRef(null)
  const board = useRef(null)
  const [boxWidth, setBoxWidth] = useState(1000)
  const [drag, setDrag] = useState(null) // { id, dx, previewT } while a card is being dragged
  const [settling, setSettling] = useState(null) // { id, t }: a dropped card held in place until the server confirms

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBoxWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale = useUi((s) => s.textScale)
  const card = cardSize(scale)
  const items = useMemo(
    () => events.map((e) => ({ ...e, t: settling?.id === e.id ? settling.t : new Date(e.at).getTime() })),
    [events, settling],
  )
  const z = zoom === 'fit' ? fitZoom(items, boxWidth, scale) : zoom
  const laneOf = mode === 'single' ? () => 'all' : (ev) => ev.type
  const axis = useMemo(
    () => buildAxis(items, z, { scale, laneOf }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- laneOf follows mode
    [items, z, scale, mode],
  )

  // Where a card dropped at left edge `x` should go in time: the layout is
  // rebuilt with it at the trial time, so it settles where the finger let go.
  const dropTime = (ev, x, guess) =>
    timeAtX(items, ev.id, x, (t) => {
      const trial = items.map((it) => (it.id === ev.id ? { ...it, t } : it))
      const tz = zoom === 'fit' ? fitZoom(trial, boxWidth, scale) : zoom
      return buildAxis(trial, tz, { scale, laneOf }).xById.get(ev.id)
    }, guess)
  const { lanes, height } = laneLayout(mode, axis.rowsByLane, scale)
  const laneFor = (ev) => (mode === 'single' ? lanes[0] : lanes.find((l) => l.id === ev.type) ?? lanes[0])
  const width = Math.max(boxWidth, axis.width)

  // Latest values for the window-level drag listeners.
  const live = useRef({})
  live.current = { onMove, onSelect, onCardMenu, axis, dropTime }

  /*
   * The layout is frozen for the whole drag: other cards stay put and the
   * dragged card follows the pointer exactly. The drop time is read from
   * the frozen axis at the card's new left edge. Listeners live on window
   * so the drag survives React reordering DOM nodes mid-gesture.
   */
  function pointerDown(e, ev) {
    if (e.button !== 0) return
    const startClientX = e.clientX
    const startClientY = e.clientY
    const baseX = live.current.axis.xById.get(ev.id)
    let moved = false
    let previewT = ev.t

    // Holding a finger still on a card opens the same menu as right-click.
    let pressed = false
    let pressTimer = null
    if (e.pointerType !== 'mouse' && live.current.onCardMenu) {
      pressTimer = setTimeout(() => {
        pressed = true
        navigator.vibrate?.(10)
        live.current.onCardMenu(ev, startClientX, startClientY)
      }, LONG_PRESS_MS)
    }

    const move = (me) => {
      const dx = me.clientX - startClientX
      if (pressTimer && Math.hypot(dx, me.clientY - startClientY) > LONG_PRESS_SLOP) { clearTimeout(pressTimer); pressTimer = null }
      if (pressed || !live.current.onMove || (!moved && Math.abs(dx) < 5)) return
      moved = true
      const x = Math.max(0, baseX + dx)
      previewT = live.current.dropTime(ev, x, live.current.axis.tOf(x))
      setDrag({ id: ev.id, dx, previewT })
    }
    const finish = (commit) => () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      clearTimeout(pressTimer)
      setDrag(null)
      if (!commit || pressed) return
      if (!moved) live.current.onSelect?.(ev)
      else if (previewT !== ev.t) {
        // Hold the card where it was dropped instead of letting it snap back while the server confirms.
        setSettling({ id: ev.id, t: previewT })
        Promise.resolve(live.current.onMove(ev, new Date(previewT).toISOString())).finally(() => setSettling(null))
      }
    }
    const onUp = finish(true)
    const onCancel = finish(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  function doubleClick(e) {
    if (!onCreateAt || e.target.closest('[data-card]')) return
    const x = e.clientX - board.current.getBoundingClientRect().left
    onCreateAt(new Date(snap(axis.tOf(x))).toISOString())
  }

  function cardMenu(e, ev) {
    if (!onCardMenu) return
    e.preventDefault()
    let { clientX: x, clientY: y } = e
    if (!x && !y) { // opened from the keyboard (context-menu key / Shift+F10)
      const r = e.currentTarget.getBoundingClientRect()
      x = r.left + 24
      y = r.top + 24
    }
    onCardMenu(ev, x, y)
  }

  function keyDown(e, ev) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect?.(ev)
    }
    if (onMove && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault()
      const step = e.shiftKey ? NUDGE.shift : NUDGE.normal
      onMove(ev, new Date(ev.t + (e.key === 'ArrowLeft' ? -step : step)).toISOString())
    }
  }

  const dragX = drag ? Math.max(0, axis.xById.get(drag.id) + drag.dx) : null

  return (
    <div ref={(el) => { scroller.current = el; if (scrollRef) scrollRef.current = el }} className="overflow-x-auto overflow-y-hidden scrollbar-thin">
      <div ref={board} className="relative select-none" style={{ width, height }} onDoubleClick={doubleClick}>
        {/* Axis */}
        <div className="absolute right-0 left-0 border-b-2 border-line" style={{ top: AXIS_H - 18 }} />
        {axis.days.map((d) => (
          <div key={d.t}>
            <div className="absolute top-2 text-sm font-bold whitespace-nowrap text-muted" style={{ left: d.x }}>{fmtDay(d.t)}</div>
            {d.divider !== null && (
              <div className="absolute top-0 bottom-0 border-l border-dotted border-muted/40" style={{ left: d.divider }} aria-hidden />
            )}
          </div>
        ))}
        {axis.gaps.map((g) => (
          <div key={g.from} className="absolute flex justify-center text-xs whitespace-nowrap text-muted italic" style={{ left: g.from, width: g.to - g.from, top: AXIS_H - 40 }}>
            <span className="rounded bg-surface px-1.5">⋯ {g.label} ⋯</span>
          </div>
        ))}

        {/* Lanes */}
        {lanes.map((lane, i) => (
          <div key={lane.id} className={cx('absolute right-0 left-0', i % 2 ? 'bg-surface-2/40' : '')} style={{ top: lane.y, height: lane.height }}>
            {lane.label && (
              <span className={cx('sticky left-0 z-10 ml-2 inline-flex rounded-full bg-surface/90 px-2 py-0.5 text-xs font-bold uppercase', TYPE_STYLE[lane.id].text)}>
                {lane.label}
              </span>
            )}
          </div>
        ))}

        {/* Axis dots, and a guide line while dragging */}
        {items.map((ev) => (
          <span key={`dot-${ev.id}`} aria-hidden className={cx('absolute h-3 w-3 -translate-x-1/2 rounded-full ring-2 ring-surface', TYPE_STYLE[ev.type].dot, drag?.id === ev.id && 'opacity-30')} style={{ left: axis.xById.get(ev.id), top: AXIS_H - 23 }} />
        ))}
        {drag && <div className="absolute top-0 bottom-0 z-10 w-0.5 bg-accent/60" style={{ left: dragX }} aria-hidden />}

        {/* Cards */}
        {items.map((ev) => {
          const lane = laneFor(ev)
          const dragging = drag?.id === ev.id
          const attachments = ev.attachments?.length ?? 0
          return (
            <div
              key={ev.id}
              data-card
              role="button"
              tabIndex={0}
              aria-label={`${ev.label}, ${fmtDateTime(ev.t)}${onMove ? '. Alt plus arrow keys move by 15 minutes; add Shift for a day. Context-menu key or long-press for edit or delete.' : ''}`}
              aria-pressed={selectedId === ev.id}
              onPointerDown={(e) => pointerDown(e, ev)}
              onContextMenu={(e) => cardMenu(e, ev)}
              onKeyDown={(e) => keyDown(e, ev)}
              className={cx(
                'no-callout absolute flex touch-none overflow-hidden rounded-xl border bg-surface text-left shadow-card duration-200 ease-[var(--ease-fluid)]',
                // Other cards glide to their new spots after a drop; the dragged one tracks the finger exactly.
                dragging ? 'transition-[box-shadow,scale,border-color]' : 'transition-[box-shadow,scale,border-color,left,top] motion-reduce:transition-[box-shadow,scale,border-color]',
                onMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                selectedId === ev.id ? 'border-accent ring-2 ring-accent/40' : 'border-transparent hover:shadow-[var(--shadow-lift)]',
                // A dragged card lifts off the board: slightly larger, deeper shadow.
                dragging && 'z-20 scale-[1.03] shadow-[var(--shadow-float)] ring-2 ring-accent/50',
              )}
              style={{ left: dragging ? dragX : axis.xById.get(ev.id), top: cardTop(lane, axis.nodeById.get(ev.id)?.row ?? 0, scale), width: card.w, height: card.h }}
            >
              <span className={cx('w-1.5 shrink-0', TYPE_STYLE[ev.type].bar)} />
              <span className="flex min-w-0 flex-1 flex-col px-3 py-2">
                <span className={cx('text-sm font-semibold tabular-nums', TYPE_STYLE[ev.type].text)}>
                  {dragging ? fmtDateTime(drag.previewT) : fmtTime(ev.t)}
                </span>
                <span className="line-clamp-2 leading-snug font-semibold">{ev.label}</span>
                {attachments > 0 && (
                  <span className="mt-auto flex items-center gap-1 text-xs text-muted">
                    <Icon name="link" size={12} /> {attachments} attached
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
