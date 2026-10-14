import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/icons'
import { cx } from '../../components/ui'
import { EVENT_TYPES, fmtDateTime, fmtDay, fmtTime } from '../../lib/format'
import { AXIS_H, CARD_H, CARD_W, LANE_PAD, PAD_X, ROW_GAP, buildAxis, layoutLanes, snap } from './layout'

export const TYPE_STYLE = {
  testimony: { bar: 'bg-testimony', text: 'text-testimony', dot: 'bg-testimony' },
  physical: { bar: 'bg-physical', text: 'text-physical', dot: 'bg-physical' },
  document: { bar: 'bg-document', text: 'text-document', dot: 'bg-document' },
}

const LANE_IDS = EVENT_TYPES.map((t) => t.id)
const NUDGE = { normal: 15 * 60e3, shift: 24 * 3600e3 }

/**
 * Shared horizontal timeline.
 *  zoom: number | 'fit'      onSelect(ev)       onMove(ev, newIso)  (omit to make read-only)
 */
export default function Timeline({ events, zoom = 1, selectedId, onSelect, onMove }) {
  const scroller = useRef(null)
  const [boxWidth, setBoxWidth] = useState(1000)
  const [drag, setDrag] = useState(null) // { id, previewT, moved } while a card is being dragged

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBoxWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const items = useMemo(() => events.map((e) => ({ ...e, t: new Date(e.at).getTime() })), [events])

  // While dragging, the axis is built without the dragged event so the others stay put.
  const axisTimes = useMemo(() => items.filter((e) => e.id !== drag?.id).map((e) => e.t), [items, drag?.id])
  const baseAxis = useMemo(() => buildAxis(axisTimes, 1), [axisTimes])
  const effectiveZoom = zoom === 'fit'
    ? Math.min(2.5, Math.max(0.15, baseAxis.span ? (boxWidth - CARD_W - PAD_X * 2) / baseAxis.span : 1))
    : zoom
  const axis = useMemo(() => buildAxis(axisTimes, effectiveZoom), [axisTimes, effectiveZoom])

  const placed = useMemo(
    () => items.map((e) => (drag && e.id === drag.id ? { ...e, t: drag.previewT } : e)),
    [items, drag],
  )
  const { lanes, height } = useMemo(() => layoutLanes(placed, axis.xOf, LANE_IDS), [placed, axis])

  const minX = Math.min(PAD_X, ...lanes.flatMap((l) => l.items.map((i) => i.x)))
  const offset = PAD_X - minX
  const maxX = Math.max(0, ...lanes.flatMap((l) => l.items.map((i) => i.x)))
  const width = Math.max(boxWidth, maxX + offset + CARD_W + PAD_X)

  // Latest values for the window-level drag listeners below.
  const live = useRef({})
  live.current = { onMove, onSelect, items, effectiveZoom }

  /*
   * Drags are tracked on window rather than with pointer capture: while a
   * card moves past others React reorders the DOM nodes, which would drop
   * the capture and lose the pointerup.
   */
  function pointerDown(e, ev) {
    if (e.button !== 0) return
    const { items: all, effectiveZoom: z } = live.current
    // Map pixels ↔ time with the axis the others are drawn on during the drag.
    const ax = buildAxis(all.filter((i) => i.id !== ev.id).map((i) => i.t), z)
    const d = { ev, startClientX: e.clientX, startX: ax.xOf(ev.t), previewT: ev.t, moved: false }

    const move = (me) => {
      const dx = me.clientX - d.startClientX
      if (!live.current.onMove || (!d.moved && Math.abs(dx) < 5)) return
      d.moved = true
      d.previewT = snap(ax.tOf(d.startX + dx))
      setDrag({ id: ev.id, previewT: d.previewT, moved: true })
    }
    const finish = (commit) => () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      setDrag(null)
      if (!commit) return
      if (!d.moved) live.current.onSelect?.(ev)
      else if (d.previewT !== ev.t) live.current.onMove(ev, new Date(d.previewT).toISOString())
    }
    const onUp = finish(true)
    const onCancel = finish(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
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

  return (
    <div ref={scroller} className="overflow-x-auto overflow-y-hidden scrollbar-thin">
      <div className="relative" style={{ width, height: Math.max(height, AXIS_H + 3 * (CARD_H + LANE_PAD * 2)) }}>
        {/* Axis */}
        <div className="absolute right-0 left-0 border-b-2 border-line" style={{ top: AXIS_H - 18 }} />
        {axis.days.map((d) => (
          <div key={d.t} className="absolute top-2 text-sm font-bold whitespace-nowrap text-muted" style={{ left: d.x + offset }}>
            {fmtDay(d.t)}
          </div>
        ))}
        {axis.gaps.map((g) => (
          <div
            key={g.from}
            className="absolute flex items-center justify-center text-xs whitespace-nowrap text-muted italic"
            style={{ left: g.from + offset + 24, width: Math.max(0, g.to - g.from - 48), top: AXIS_H - 40 }}
          >
            <span className="rounded bg-bg px-1.5">⋯ {g.label} ⋯</span>
          </div>
        ))}
        {lanes.flatMap((lane) => lane.items).map(({ ev, x }) => (
          <span
            key={`dot-${ev.id}`}
            className={cx('absolute h-3 w-3 -translate-x-1/2 rounded-full ring-2 ring-bg', TYPE_STYLE[ev.type].dot)}
            style={{ left: x + offset, top: AXIS_H - 23 }}
            aria-hidden
          />
        ))}

        {/* Lanes */}
        {lanes.map((lane, li) => (
          <div key={lane.id} className={cx('absolute right-0 left-0', li % 2 ? 'bg-surface-2/40' : '')} style={{ top: lane.y, height: lane.height }}>
            <span className={cx('sticky left-0 z-10 ml-2 inline-flex items-center gap-1.5 rounded-full bg-bg/90 px-2 py-0.5 text-xs font-bold uppercase', TYPE_STYLE[lane.id].text)} style={{ marginTop: 2 }}>
              {EVENT_TYPES[li].label}
            </span>
          </div>
        ))}

        {/* Stem from the axis to the selected card */}
        {lanes.flatMap((lane) => lane.items.map((it) => ({ ...it, lane }))).filter((it) => it.ev.id === selectedId || it.ev.id === drag?.id).map(({ ev, x, row, lane }) => (
          <div
            key={`stem-${ev.id}`}
            className={cx('absolute w-0.5 opacity-50', TYPE_STYLE[ev.type].bar)}
            style={{ left: x + offset - 1, top: AXIS_H - 18, height: lane.y - (AXIS_H - 18) + LANE_PAD + row * (CARD_H + ROW_GAP) }}
          />
        ))}

        {/* Cards */}
        {lanes.map((lane) =>
          lane.items.map(({ ev, x, row }) => {
            const dragging = drag?.id === ev.id && drag.moved
            const attachments = ev.attachments?.length ?? 0
            return (
              <div
                key={ev.id}
                role="button"
                tabIndex={0}
                aria-label={`${ev.label}, ${fmtDateTime(ev.t)}${onMove ? '. Alt plus arrow keys move by 15 minutes; add Shift for a day.' : ''}`}
                aria-pressed={selectedId === ev.id}
                onPointerDown={(e) => pointerDown(e, ev)}
                onKeyDown={(e) => keyDown(e, ev)}
                className={cx(
                  'absolute flex touch-none overflow-hidden rounded-lg border bg-surface text-left shadow-sm select-none',
                  onMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                  selectedId === ev.id ? 'border-accent ring-2 ring-accent/40' : 'border-line hover:border-muted',
                  dragging && 'z-20 opacity-90 shadow-lg',
                )}
                style={{ left: x + offset, top: lane.y + LANE_PAD + row * (CARD_H + ROW_GAP), width: CARD_W, height: CARD_H }}
              >
                <span className={cx('w-1.5 shrink-0', TYPE_STYLE[ev.type].bar)} />
                <span className="flex min-w-0 flex-1 flex-col px-3 py-2">
                  <span className={cx('text-sm font-semibold tabular-nums', TYPE_STYLE[ev.type].text)}>
                    {dragging ? fmtDateTime(ev.t) : fmtTime(ev.t)}
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
          }),
        )}
      </div>
    </div>
  )
}
