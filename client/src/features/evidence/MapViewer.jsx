import { useEffect, useMemo, useRef, useState } from 'react'
import { ICON_PATHS, Icon } from '../../components/icons'
import { Button, IconButton, cx } from '../../components/ui'

/*
 * Interactive map exhibit, drawn as SVG from a validated JSON spec. No map
 * tiles or network: shapes, roads and places come from the exhibit itself.
 * Pan by dragging, zoom with the wheel or buttons, toggle layers, click a
 * place for details and related exhibits, and measure distances.
 */

const AREA_FILL = {
  block: 'var(--color-map-block)',
  park: 'var(--color-map-park)',
  water: 'var(--color-map-water)',
  industrial: 'var(--color-map-industrial)',
}
const CIRCLE_COLORS = ['var(--color-viz-2)', 'var(--color-viz-3)', 'var(--color-viz-1)']

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]

export default function MapViewer({ spec, onOpenExhibitNumber }) {
  const full = { x: 0, y: 0, w: spec.width, h: spec.height }
  const [view, setView] = useState(full)
  const [layers, setLayers] = useState(() => Object.fromEntries(spec.layers.map((l) => [l.id, l.on])))
  const [selectedId, setSelectedId] = useState(null)
  const [measuring, setMeasuring] = useState(false)
  const [measurePts, setMeasurePts] = useState([])
  const svgRef = useRef(null)
  const viewRef = useRef(view)
  viewRef.current = view

  // Text, markers and outlines stay a constant size on screen; roads scale with the map.
  const [box, setBox] = useState({ w: 800, h: 600 })
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width || 800, h: e.contentRect.height || 600 }))
    ro.observe(svgRef.current)
    return () => ro.disconnect()
  }, [])
  const k = 1 / Math.min(box.w / view.w, box.h / view.h) // map units per screen pixel
  const roadK = Math.max(view.w / spec.width, 0.35)
  const visible = (f) => !f.layer || layers[f.layer]
  const features = spec.features.filter(visible)
  const selected = spec.features.find((f) => f.id === selectedId)
  const markers = spec.features.filter((f) => f.type === 'marker')
  const circleColor = useMemo(() => {
    const m = {}
    spec.features.filter((f) => f.type === 'circle').forEach((c, i) => { m[c.id] = CIRCLE_COLORS[i % CIRCLE_COLORS.length] })
    return m
  }, [spec])

  const clampView = (v) => {
    const w = Math.min(spec.width, Math.max(spec.width / 8, v.w))
    const h = w * (spec.height / spec.width)
    return { w, h, x: Math.min(spec.width - w, Math.max(0, v.x)), y: Math.min(spec.height - h, Math.max(0, v.y)) }
  }

  const toMap = (clientX, clientY, ctm = svgRef.current.getScreenCTM()) => {
    const p = svgRef.current.createSVGPoint()
    p.x = clientX
    p.y = clientY
    const r = p.matrixTransform(ctm.inverse())
    return [r.x, r.y]
  }

  const zoomAt = (factor, center) => {
    const v = viewRef.current
    const c = center ?? [v.x + v.w / 2, v.y + v.h / 2]
    const w = v.w * factor
    const scale = w / v.w
    setView(clampView({ w, x: c[0] - (c[0] - v.x) * scale, y: c[1] - (c[1] - v.y) * scale }))
  }

  // Wheel zoom needs a non-passive listener so the page doesn't scroll.
  useEffect(() => {
    const el = svgRef.current
    const onWheel = (e) => {
      e.preventDefault()
      zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, toMap(e.clientX, e.clientY))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function pointerDown(e) {
    if (e.button !== 0 || (!measuring && e.target.closest('[data-feature]'))) return
    const ctm = svgRef.current.getScreenCTM()
    const start = toMap(e.clientX, e.clientY, ctm)
    // While measuring, clicking a place snaps the point to that place.
    const place = measuring && e.target.closest('[data-x]')
    const point = place ? [Number(place.dataset.x), Number(place.dataset.y)] : start
    const startView = viewRef.current
    let moved = false
    const move = (me) => {
      const p = toMap(me.clientX, me.clientY, ctm)
      if (!moved && Math.hypot(me.clientX - e.clientX, me.clientY - e.clientY) < 4) return
      moved = true
      setView(clampView({ ...startView, x: startView.x + (start[0] - p[0]), y: startView.y + (start[1] - p[1]) }))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (!moved && measuring) setMeasurePts((pts) => [...pts, point])
      else if (!moved) setSelectedId(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const measured = measurePts.slice(1).reduce((s, p, i) => s + dist(measurePts[i], p), 0)
  const miles = spec.milesPerUnit ? measured * spec.milesPerUnit : null

  const select = (f) => (e) => {
    e.stopPropagation()
    if (!measuring) setSelectedId(f.id === selectedId ? null : f.id)
  }
  const keySelect = (f) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(f.id) }
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="relative min-w-0 flex-1 bg-[var(--color-map-land)]">
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          preserveAspectRatio="xMidYMid meet"
          className={cx('h-full w-full touch-none select-none', measuring ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing')}
          onPointerDown={pointerDown}
          role="img"
          aria-label={spec.title}
        >
          <rect x={0} y={0} width={spec.width} height={spec.height} fill="var(--color-map-land)" />
          {spec.areas.map((a, i) => (
            <polygon key={i} points={a.points.join(' ')} fill={AREA_FILL[a.kind]} stroke="var(--color-map-road-edge)" strokeWidth={0.5 * k} />
          ))}
          {spec.roads.map((r, i) => (
            <g key={i}>
              <polyline points={r.points.join(' ')} fill="none" stroke="var(--color-map-road-edge)" strokeWidth={(r.major ? 14 : 9) * roadK} strokeLinecap="round" />
              <polyline points={r.points.join(' ')} fill="none" stroke="var(--color-map-road)" strokeWidth={(r.major ? 11 : 6) * roadK} strokeLinecap="round" />
            </g>
          ))}
          {/* Road labels */}
          {spec.roads.filter((r) => r.label).map((r, i) => {
            const [a, b] = r.points
            const vertical = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0])
            const x = vertical ? a[0] + 10 * k : a[0] + (b[0] - a[0]) * 0.12
            const y = vertical ? a[1] + (b[1] - a[1]) * 0.15 : a[1] - 9 * k
            return (
              <text key={i} x={x} y={y} fontSize={12 * k} fill="var(--color-muted)" fontStyle="italic" transform={vertical ? `rotate(90 ${x} ${y})` : undefined} style={{ paintOrder: 'stroke', stroke: 'var(--color-map-land)', strokeWidth: 3 * k }}>
                {r.label}
              </text>
            )
          })}
          {spec.areas.filter((a) => a.label).map((a, i) => {
            const [x, y] = a.labelAt ?? centroid(a.points)
            return <text key={i} x={x} y={y} textAnchor="middle" fontSize={13 * k} fill="var(--color-muted)" fontWeight="bold">{a.label}</text>
          })}

          {features.filter((f) => f.type === 'circle').map((c) => (
            <circle
              key={c.id}
              data-feature
              cx={c.x}
              cy={c.y}
              r={c.r}
              fill={circleColor[c.id]}
              fillOpacity={selectedId === c.id ? 0.22 : 0.12}
              stroke={circleColor[c.id]}
              strokeWidth={2 * k}
              strokeDasharray={`${8 * k} ${6 * k}`}
              onClick={select(c)}
              className="cursor-pointer"
            />
          ))}
          {features.filter((f) => f.type === 'route').map((r) => (
            <g key={r.id} data-feature onClick={select(r)} className="cursor-pointer">
              <polyline points={r.points.join(' ')} fill="none" stroke="transparent" strokeWidth={20 * k} />
              <polyline points={r.points.join(' ')} fill="none" stroke="var(--color-viz-1)" strokeWidth={(selectedId === r.id ? 6 : 4) * k} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${12 * k} ${7 * k}`} />
            </g>
          ))}
          {features.filter((f) => f.type === 'marker').map((m) => {
            const active = selectedId === m.id
            const s = 26 * k
            return (
              <g
                key={m.id}
                data-feature
                data-x={m.x}
                data-y={m.y}
                role="button"
                tabIndex={0}
                aria-label={m.label}
                aria-pressed={active}
                onClick={select(m)}
                onKeyDown={keySelect(m)}
                className="cursor-pointer focus:outline-none"
              >
                <circle cx={m.x} cy={m.y} r={s / 2 + 2 * k} fill="var(--color-surface)" stroke={active ? 'var(--color-accent)' : 'var(--color-ink)'} strokeWidth={(active ? 3 : 1.5) * k} />
                <g transform={`translate(${m.x - s * 0.33} ${m.y - s * 0.33}) scale(${(s * 0.66) / 24})`}>
                  <path d={ICON_PATHS[m.icon] ?? ICON_PATHS.pin} fill="none" stroke="var(--color-ink)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </g>
                <text x={m.x + s / 2 + 6 * k} y={m.y + 5 * k} fontSize={14 * k} fontWeight="bold" fill="var(--color-ink)" style={{ paintOrder: 'stroke', stroke: 'var(--color-map-land)', strokeWidth: 4 * k }}>
                  {m.label}
                </text>
              </g>
            )
          })}

          {measurePts.length > 0 && (
            <g pointerEvents="none">
              <polyline points={measurePts.join(' ')} fill="none" stroke="var(--color-accent)" strokeWidth={3 * k} strokeDasharray={`${4 * k} ${4 * k}`} />
              {measurePts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={6 * k} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={2 * k} />)}
            </g>
          )}
        </svg>

        {/* Controls */}
        <div className="material absolute top-3 left-3 flex flex-col overflow-hidden rounded-xl">
          <IconButton icon="plus" label="Zoom in" onClick={() => zoomAt(1 / 1.4)} className="rounded-none" />
          <IconButton icon="minus" label="Zoom out" onClick={() => zoomAt(1.4)} className="rounded-none" />
          <IconButton icon="compass" label="Reset view" onClick={() => setView(full)} className="rounded-none" />
        </div>
        {spec.milesPerUnit && (
          <div className="material absolute bottom-3 left-3 flex items-center gap-3 rounded-full p-1.5 pr-4">
            <Button size="sm" variant={measuring ? 'primary' : 'secondary'} icon="ruler" onClick={() => { setMeasuring(!measuring); setMeasurePts([]) }} aria-pressed={measuring}>
              {measuring ? 'Measuring' : 'Measure distance'}
            </Button>
            {measuring && (
              <span className="text-sm tabular-nums" aria-live="polite">
                {measurePts.length < 2 ? 'Click points on the map' : `${miles.toFixed(2)} mi`}
              </span>
            )}
            {measuring && measurePts.length > 0 && <Button size="sm" variant="ghost" onClick={() => setMeasurePts([])}>Clear</Button>}
          </div>
        )}
      </div>

      {/* Side panel: layers, selection, places */}
      <aside className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-l border-line bg-surface p-4 scrollbar-thin">
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-[0.8125rem] font-semibold text-muted"><Icon name="layers" size={16} /> Layers</h3>
          <ul className="flex flex-col gap-1.5">
            {spec.layers.map((l) => (
              <li key={l.id}>
                <label className="flex items-center justify-between gap-2">
                  {l.label}
                  <input type="checkbox" checked={!!layers[l.id]} onChange={(e) => setLayers({ ...layers, [l.id]: e.target.checked })} role="switch" className="switch scale-90" />
                </label>
              </li>
            ))}
          </ul>
        </section>

        {selected ? (
          <section className="rounded-xl bg-accent-soft p-3" aria-live="polite">
            <h3 className="font-bold">{selected.label}</h3>
            {selected.time && <p className="text-sm font-semibold text-accent">{selected.time}</p>}
            {selected.detail && <p className="mt-1 text-sm">{selected.detail}</p>}
            {selected.type === 'route' && spec.milesPerUnit && (
              <p className="mt-1 text-sm text-muted">
                Measured on this map: {(selected.points.slice(1).reduce((s, p, i) => s + dist(selected.points[i], p), 0) * spec.milesPerUnit).toFixed(1)} mi
              </p>
            )}
            {selected.exhibits?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selected.exhibits.map((n) => (
                  <button key={n} type="button" onClick={() => onOpenExhibitNumber?.(n)} className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 text-sm font-semibold text-accent hover:underline">
                    <Icon name="link" size={13} /> {n}
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <p className="text-sm text-muted">Click a place, route or coverage area for details. Drag to pan; scroll to zoom.</p>
        )}

        <section>
          <h3 className="mb-2 text-[0.8125rem] font-semibold text-muted">Places</h3>
          <ul className="flex flex-col gap-0.5">
            {markers.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(m.id)
                    if (m.layer) setLayers((l) => ({ ...l, [m.layer]: true }))
                  }}
                  className={cx('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm', selectedId === m.id ? 'bg-accent font-semibold text-accent-ink' : 'hover:bg-fill')}
                >
                  <Icon name={m.icon} size={16} className={cx('shrink-0', selectedId === m.id ? 'text-accent-ink' : 'text-accent')} /> {m.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  )
}
