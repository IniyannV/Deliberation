import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { load, store } from '../../lib/storage'

export const clamp01 = (v) => Math.min(1, Math.max(0, v))
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
export const DEFAULT_NOTE_SIZE = { w: 288, h: 0 } // h 0: as tall as the content

export function LeaderLine({ x, y, box, card, pinRadius = 16, color = 'var(--color-accent)' }) {
  const px = x * box.w
  const py = y * box.h
  const cx = clamp(px, card.left, card.left + card.w)
  const cy = clamp(py, card.top, card.top + card.h)
  const len = Math.hypot(cx - px, cy - py)
  if (len <= pinRadius + 2) return null // the card covers or touches the pin
  const sx = px + ((cx - px) / len) * pinRadius
  const sy = py + ((cy - py) / len) * pinRadius
  return (
    <svg aria-hidden className="pointer-events-none absolute top-0 left-0 z-20 overflow-visible" width={box.w} height={box.h}>
      <line x1={sx} y1={sy} x2={cx} y2={cy} stroke={color} strokeWidth="1.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={cx} cy={cy} r="2.5" fill={color} />
    </svg>
  )
}

export function NoteCard({ x, y, label, children, onClose, pinRadius = 16, color }) {
  const ref = useRef(null)
  const [offset, setOffset] = useState(null)
  const [size, setSize] = useState(() => load('noteSize', DEFAULT_NOTE_SIZE))
  const [dims, setDims] = useState(null)

  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.offsetParent
    if (!el || !parent) return
    const measure = () => setDims({ box: { w: parent.clientWidth, h: parent.clientHeight }, w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.offsetParent
    const pW = parent?.clientWidth ?? window.innerWidth
    const pH = parent?.clientHeight ?? window.innerHeight
    const cardW = el?.offsetWidth || size.w || 288
    const cardH = el?.offsetHeight || 220
    const pinX = x * pW
    const pinY = y * pH

    let targetLeft = pinX + (pinX + cardW + 36 <= pW ? 36 : -(cardW + 36))
    let targetTop = pinY - 16

    const clampedLeft = Math.max(12, Math.min(pW - cardW - 12, targetLeft))
    const clampedTop = Math.max(12, Math.min(pH - cardH - 12, targetTop))

    setOffset({ dx: clampedLeft - pinX, dy: clampedTop - pinY })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    const key = (e) => { if (e.key === 'Escape') onClose() }
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
      if (kind === 'move') {
        const parent = ref.current?.offsetParent
        const pW = parent?.clientWidth ?? window.innerWidth
        const pH = parent?.clientHeight ?? window.innerHeight
        const cardW = ref.current.offsetWidth
        const cardH = ref.current.offsetHeight
        const pinX = x * pW
        const pinY = y * pH
        const rawLeft = pinX + from.dx + dx
        const rawTop = pinY + from.dy + dy
        const clampedLeft = Math.max(8, Math.min(pW - cardW - 8, rawLeft))
        const clampedTop = Math.max(8, Math.min(pH - cardH - 8, rawTop))
        setOffset({ dx: clampedLeft - pinX, dy: clampedTop - pinY })
      } else {
        setSize((resized = { w: clamp(box.w + dx, 220, 720), h: clamp(box.h + dy, 120, 720) }))
      }
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
    <>
      {offset && dims && (
        <LeaderLine
          x={x}
          y={y}
          box={dims.box}
          card={{ left: x * dims.box.w + offset.dx, top: y * dims.box.h + offset.dy, w: dims.w, h: dims.h }}
          pinRadius={pinRadius}
          color={color}
        />
      )}
      <div
        ref={ref}
        role="dialog"
        aria-label={label}
        className="material materialize absolute z-30 flex flex-col rounded-2xl text-left shadow-xl"
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
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M9 1L1 9M9 5L5 9" />
          </svg>
        </div>
      </div>
    </>
  )
}
