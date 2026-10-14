/*
 * Horizontal timeline geometry.
 *
 * Real cases mix events minutes apart with events weeks apart, so a linear
 * scale is unreadable. Instead each pair of consecutive event times is
 * spaced by a log of the gap: a 5-minute gap is ~160px, a day is ~470px, a
 * month is ~810px. Between event times the mapping is linear, so it is
 * monotonic and invertible, and dragging a card maps a pixel back to a time.
 */

const HOUR = 3600e3
export const CARD_W = 216
export const CARD_H = 118
export const ROW_GAP = 10
export const LANE_PAD = 14
export const AXIS_H = 72
export const PAD_X = 56
export const SNAP_MS = 5 * 60e3

const spacing = (dtH) => (dtH <= 0 ? 0 : 150 + 70 * Math.log2(1 + dtH))

export function humanGap(ms) {
  const h = ms / HOUR
  if (h < 48) return `${Math.round(h)} hours later`
  const d = Math.round(h / 24)
  if (d < 14) return `${d} days later`
  if (d < 60) return `${Math.round(d / 7)} weeks later`
  return `${Math.round(d / 30)} months later`
}

export function buildAxis(times, zoom = 1) {
  const sorted = [...new Set(times)].sort((a, b) => a - b)
  const nodes = []
  let x = PAD_X
  sorted.forEach((t, i) => {
    if (i > 0) x += spacing((t - sorted[i - 1]) / HOUR) * zoom
    nodes.push({ t, x })
  })
  const edgePxPerHour = 80 * zoom

  const xOf = (t) => {
    if (!nodes.length) return PAD_X
    const first = nodes[0]
    const last = nodes.at(-1)
    if (t <= first.t) return first.x - ((first.t - t) / HOUR) * edgePxPerHour
    if (t >= last.t) return last.x + ((t - last.t) / HOUR) * edgePxPerHour
    let i = 0
    while (nodes[i + 1].t < t) i++
    const a = nodes[i], b = nodes[i + 1]
    return a.x + ((t - a.t) / (b.t - a.t)) * (b.x - a.x)
  }

  const tOf = (px) => {
    if (!nodes.length) return Date.now()
    const first = nodes[0]
    const last = nodes.at(-1)
    if (px <= first.x) return first.t - ((first.x - px) / edgePxPerHour) * HOUR
    if (px >= last.x) return last.t + ((px - last.x) / edgePxPerHour) * HOUR
    let i = 0
    while (nodes[i + 1].x < px) i++
    const a = nodes[i], b = nodes[i + 1]
    if (b.x === a.x) return a.t
    return a.t + ((px - a.x) / (b.x - a.x)) * (b.t - a.t)
  }

  // Calendar-day labels at the first event of each day, and markers for long gaps.
  const days = []
  let lastDay = ''
  for (const n of nodes) {
    const key = new Date(n.t).toDateString()
    if (key !== lastDay) days.push({ x: n.x, t: n.t })
    lastDay = key
  }
  const gaps = []
  for (let i = 1; i < nodes.length; i++) {
    const dt = nodes[i].t - nodes[i - 1].t
    if (dt > 18 * HOUR) gaps.push({ from: nodes[i - 1].x, to: nodes[i].x, label: humanGap(dt) })
  }

  const span = nodes.length ? nodes.at(-1).x - nodes[0].x : 0
  return { nodes, xOf, tOf, days, gaps, span }
}

/** Packs cards into three type lanes, stacking rows where cards would overlap. */
export function layoutLanes(events, xOf, laneIds) {
  const lanes = laneIds.map((id) => ({ id, rows: [], items: [] }))
  const byId = Object.fromEntries(lanes.map((l) => [l.id, l]))
  const sorted = [...events].sort((a, b) => a.t - b.t || a.id.localeCompare(b.id))
  for (const ev of sorted) {
    const lane = byId[ev.type] ?? lanes[0]
    const x = xOf(ev.t)
    let row = lane.rows.findIndex((right) => right + 10 <= x)
    if (row === -1) {
      row = lane.rows.length
      lane.rows.push(0)
    }
    lane.rows[row] = x + CARD_W
    lane.items.push({ ev, x, row })
  }
  let y = AXIS_H
  for (const lane of lanes) {
    lane.y = y
    lane.height = Math.max(1, lane.rows.length) * (CARD_H + ROW_GAP) - ROW_GAP + LANE_PAD * 2
    y += lane.height
  }
  return { lanes, height: y }
}

export const snap = (t) => Math.round(t / SNAP_MS) * SNAP_MS
