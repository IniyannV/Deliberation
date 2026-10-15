import { useEffect, useMemo, useRef, useState } from 'react'
import { Segmented, cx } from '../../components/ui'
import { fmtTime } from '../../lib/format'

/*
 * Interactive chart exhibits drawn as SVG. Series colours are the three
 * validated --color-viz slots (charts accept at most three categories), and
 * every chart has a hover tooltip, text labels and a table view, so identity
 * never rests on colour alone.
 */

const SERIES = ['var(--color-viz-1)', 'var(--color-viz-2)', 'var(--color-viz-3)']

function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(700)
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

function niceStep(max, ticks = 5) {
  const raw = max / ticks
  const mag = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)
}

function Tooltip({ tip }) {
  if (!tip) return null
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 max-w-64 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lg"
      style={{ left: tip.x, top: tip.y, transform: `translate(${tip.flip ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}
    >
      {tip.children}
    </div>
  )
}

function BarChart({ spec, sort }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const fmt = (v) => `${spec.valuePrefix}${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  const bars = useMemo(() => (sort === 'value' ? [...spec.bars].sort((a, b) => b.value - a.value) : spec.bars), [spec.bars, sort])
  const LABEL_W = Math.min(260, width * 0.38)
  const VALUE_W = 90
  const ROW = 40
  const BAR_H = 20
  const top = 28
  const plotW = width - LABEL_W - VALUE_W - 16
  const max = Math.max(...bars.map((b) => b.value), 1)
  const step = niceStep(max)
  const niceMax = Math.ceil(max / step) * step
  const xs = (v) => LABEL_W + (v / niceMax) * plotW
  const height = top + bars.length * ROW + 8
  const ticks = Array.from({ length: Math.round(niceMax / step) + 1 }, (_, i) => i * step)

  return (
    <div ref={ref} className="relative">
      <svg width={width} height={height} role="img" aria-label={`${spec.title}. Bar chart; use the table view for exact values.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={xs(t)} x2={xs(t)} y1={top - 6} y2={height - 8} stroke="var(--color-line)" strokeWidth={1} />
            <text x={xs(t)} y={top - 12} textAnchor="middle" fontSize={12} fill="var(--color-muted)">{fmt(t)}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const y = top + i * ROW + (ROW - BAR_H) / 2
          const w = Math.max(2, xs(b.value) - LABEL_W)
          const r = Math.min(4, w)
          const active = hover?.label === b.label
          return (
            <g
              key={b.label}
              onPointerMove={(e) => {
                const box = ref.current.getBoundingClientRect()
                setHover({ label: b.label, x: e.clientX - box.left, y: e.clientY - box.top })
              }}
              onPointerLeave={() => setHover(null)}
            >
              <rect x={0} y={top + i * ROW} width={width} height={ROW} fill={active ? 'var(--color-surface-2)' : 'transparent'} />
              <text x={LABEL_W - 12} y={y + BAR_H / 2 + 5} textAnchor="end" fontSize={14} fill="var(--color-ink)">{b.label}</text>
              {/* Square at the baseline, 4px rounded at the data end. */}
              <path d={`M${LABEL_W},${y} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${BAR_H - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - r} z`} fill="var(--color-viz-1)" opacity={hover && !active ? 0.55 : 1} />
              <text x={LABEL_W + w + 8} y={y + BAR_H / 2 + 5} fontSize={14} fontWeight="bold" fill="var(--color-ink)" className="tabular-nums">{fmt(b.value)}</text>
            </g>
          )
        })}
      </svg>
      {hover && (() => {
        const b = bars.find((x) => x.label === hover.label)
        return (
          <Tooltip tip={{ x: hover.x, y: hover.y, flip: hover.x > width * 0.65, children: (
            <>
              <p className="font-bold">{b.label}</p>
              <p className="tabular-nums">{fmt(b.value)}{spec.unit ? ` ${spec.unit}` : ''}</p>
              {b.note && <p className="text-muted">{b.note}</p>}
            </>
          ) }} />
        )
      })()}
    </div>
  )
}

function EventsChart({ spec }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const [hidden, setHidden] = useState({})
  const LABEL_W = Math.min(230, width * 0.32)
  const top = 64
  const ROW = 76
  const height = top + spec.rows.length * ROW + 34
  const times = [...spec.points.map((p) => +new Date(p.t)), ...spec.annotations.map((a) => +new Date(a.t))]
  const pad = Math.max(5 * 60e3, (Math.max(...times) - Math.min(...times)) * 0.06)
  const t0 = Math.min(...times) - pad
  const t1 = Math.max(...times) + pad
  const xs = (t) => LABEL_W + ((+new Date(t) - t0) / (t1 - t0)) * (width - LABEL_W - 24)
  const rowY = (id) => top + spec.rows.findIndex((r) => r.id === id) * ROW + ROW / 2
  const color = (cat) => SERIES[spec.categories.findIndex((c) => c.id === cat)]
  const tickEvery = niceStep((t1 - t0) / 60e3, 6) * 60e3
  const ticks = []
  for (let t = Math.ceil(t0 / tickEvery) * tickEvery; t <= t1; t += tickEvery) ticks.push(t)

  return (
    <div ref={ref} className="relative">
      {/* Legend (always shown for 2+ series); click to hide or show a category. */}
      <ul className="mb-2 flex flex-wrap gap-4 text-sm" aria-label="Legend">
        {spec.categories.map((c, i) => (
          <li key={c.id}>
            <button type="button" aria-pressed={!hidden[c.id]} onClick={() => setHidden({ ...hidden, [c.id]: !hidden[c.id] })} className={cx('flex items-center gap-2 rounded px-1', hidden[c.id] && 'opacity-40')}>
              <span className="h-3 w-3 rounded-full" style={{ background: SERIES[i] }} /> {c.label}
            </button>
          </li>
        ))}
        <li className="flex items-center gap-2 text-muted"><span className="h-3 w-0 border-l-2 border-dashed border-muted" /> Reference time</li>
      </ul>
      <svg width={width} height={height} role="img" aria-label={`${spec.title}. Events over time by row; use the table view for exact values.`}>
        {spec.rows.map((r, i) => (
          <g key={r.id}>
            <rect x={0} y={top + i * ROW} width={width} height={ROW} fill={i % 2 ? 'var(--color-surface-2)' : 'transparent'} opacity={0.5} />
            <text x={12} y={top + i * ROW + ROW / 2 - 2} fontSize={14} fontWeight="bold" fill="var(--color-ink)">{r.label}</text>
            {r.detail && <text x={12} y={top + i * ROW + ROW / 2 + 16} fontSize={12} fill="var(--color-muted)">{r.detail}</text>}
          </g>
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={xs(t)} x2={xs(t)} y1={top} y2={height - 26} stroke="var(--color-line)" />
            <text x={xs(t)} y={height - 8} textAnchor="middle" fontSize={12} fill="var(--color-muted)">{fmtTime(t)}</text>
          </g>
        ))}
        {spec.annotations.map((a, i) => (
          <g key={a.t + a.label}>
            <line x1={xs(a.t)} x2={xs(a.t)} y1={top - 18 + (i % 2) * 18} y2={height - 26} stroke="var(--color-muted)" strokeDasharray="4 4" opacity={0.7} />
            <text x={xs(a.t)} y={top - 24 + (i % 2) * 18} textAnchor="middle" fontSize={12} fill="var(--color-muted)">{a.label}</text>
          </g>
        ))}
        {spec.points.filter((p) => !hidden[p.category]).map((p, i) => {
          const active = hover?.i === i
          return (
            <g
              key={i}
              onPointerEnter={() => {
                setHover({ i, p, x: xs(p.t), y: rowY(p.row) })
              }}
              onPointerLeave={() => setHover(null)}
            >
              <circle cx={xs(p.t)} cy={rowY(p.row)} r={16} fill="transparent" />
              <circle cx={xs(p.t)} cy={rowY(p.row)} r={active ? 9 : 7} fill={color(p.category)} stroke="var(--color-surface)" strokeWidth={2} />
            </g>
          )
        })}
      </svg>
      {hover && (
        <Tooltip tip={{ x: hover.x, y: hover.y, flip: hover.x > width * 0.65, children: (
          <>
            <p className="font-bold">{hover.p.label}</p>
            <p className="tabular-nums">{fmtTime(hover.p.t)}</p>
            <p className="text-muted">{spec.rows.find((r) => r.id === hover.p.row)?.label}</p>
            {hover.p.detail && <p className="text-muted">{hover.p.detail}</p>}
          </>
        ) }} />
      )}
    </div>
  )
}

function DataTable({ spec }) {
  if (spec.chart === 'bar') {
    const total = spec.bars.reduce((s, b) => s + b.value, 0)
    return (
      <table className="w-full text-left">
        <thead className="border-b border-line text-sm text-muted"><tr><th className="py-2">Item</th><th className="py-2 text-right">Value</th><th className="py-2 pl-6">Note</th></tr></thead>
        <tbody className="divide-y divide-line">
          {spec.bars.map((b) => <tr key={b.label}><td className="py-2">{b.label}</td><td className="py-2 text-right tabular-nums">{spec.valuePrefix}{b.value.toLocaleString()}</td><td className="py-2 pl-6 text-muted">{b.note}</td></tr>)}
          <tr className="font-bold"><td className="py-2">Total</td><td className="py-2 text-right tabular-nums">{spec.valuePrefix}{total.toLocaleString()}</td><td /></tr>
        </tbody>
      </table>
    )
  }
  const sorted = [...spec.points].sort((a, b) => a.t.localeCompare(b.t))
  return (
    <table className="w-full text-left">
      <thead className="border-b border-line text-sm text-muted"><tr><th className="py-2">Time</th><th className="py-2">Event</th><th className="py-2">Category</th><th className="py-2">Row</th></tr></thead>
      <tbody className="divide-y divide-line">
        {sorted.map((p, i) => (
          <tr key={i}>
            <td className="py-2 tabular-nums">{fmtTime(p.t)}</td>
            <td className="py-2">{p.label}</td>
            <td className="py-2">{spec.categories.find((c) => c.id === p.category)?.label}</td>
            <td className="py-2 text-muted">{spec.rows.find((r) => r.id === p.row)?.label}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function ChartViewer({ spec }) {
  const [view, setView] = useState('chart')
  const [sort, setSort] = useState('value')
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
        <h3 className="font-bold">{spec.title}</h3>
        <div className="flex gap-2">
          {spec.chart === 'bar' && view === 'chart' && (
            <Segmented label="Sort" value={sort} onChange={setSort} options={[{ value: 'value', label: 'Largest first' }, { value: 'original', label: 'As listed' }]} />
          )}
          <Segmented label="View" value={view} onChange={setView} options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4 scrollbar-thin">
        {view === 'table' ? <DataTable spec={spec} /> : spec.chart === 'bar' ? <BarChart spec={spec} sort={sort} /> : <EventsChart spec={spec} />}
        {view === 'chart' && <p className="mt-3 text-sm text-muted">Hover over a {spec.chart === 'bar' ? 'bar' : 'dot'} for details{spec.chart === 'events' ? '; click a legend item to hide or show it' : ''}.</p>}
      </div>
    </div>
  )
}
