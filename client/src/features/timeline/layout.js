/*
 * Horizontal timeline geometry.
 *
 * Every event gets its own spot on the axis, in time order. Events at the
 * same moment sit directly under each other. Events close together are
 * staggered over two rows, so each one starts half a card after the last:
 * 1 and 3 on the top row, 2 below and between them. Further apart, the
 * spacing grows with the log of the time gap, so minutes apart reads as
 * "close" and weeks apart as "far" without a linear scale making one of them
 * unreadable. Between events the mapping is linear, so a pixel can be turned
 * back into a time when dragging.
 */

import { EVENT_TYPES } from '../../lib/format'

const HOUR = 3600e3
export const CARD_W = 216
export const CARD_H = 118
export const GAP = 24
export const ROW_GAP = 10
export const LANE_PAD = 14
export const AXIS_H = 72
export const PAD_X = 56
export const SNAP_MS = 5 * 60e3

const extra = (dtH) => (dtH <= 0 ? 0 : 70 * Math.log2(1 + dtH))

/** Card size at the juror's text size, so larger text still fits on a card. */
export function cardSize(scale = 1) {
  const w = Math.round(CARD_W * scale)
  const h = Math.round(CARD_H * scale)
  return { w, h, step: w + GAP, half: (w + GAP) / 2 }
}

export function humanGap(ms) {
  const h = ms / HOUR
  if (h < 48) return `${Math.round(h)} hours later`
  const d = Math.round(h / 24)
  if (d < 14) return `${d} days later`
  if (d < 60) return `${Math.round(d / 7)} weeks later`
  return `${Math.round(d / 30)} months later`
}

const byTime = (a, b) => a.t - b.t || a.id.localeCompare(b.id)

/**
 * `items` are { id, t } (t in ms). `zoom` scales only the time-gap spacing;
 * 0 means as tight as possible. `laneOf(item)` says which lane an item is
 * drawn in: cards only need to avoid each other within a lane.
 * Returns each node's x and row, and how many rows each lane needs.
 */
export function buildAxis(items, zoom = 1, { laneOf = () => 'all', scale = 1 } = {}) {
  const { w, step, half } = cardSize(scale)
  const sorted = [...items].sort(byTime)

  // A lane needs two rows for staggering. Events that share a moment need a
  // row each, plus one spare so a close neighbour can't push one aside.
  const together = new Map() // "lane|t" → how many events
  for (const it of sorted) {
    const key = `${laneOf(it)}|${it.t}`
    together.set(key, (together.get(key) ?? 0) + 1)
  }
  const rowCount = {}
  for (const [key, n] of together) {
    const lane = key.slice(0, key.lastIndexOf('|'))
    rowCount[lane] = Math.max(rowCount[lane] ?? 2, n > 1 ? n + 1 : 2)
  }

  const rowEnd = {} // lane → for each row, the first x a new card may take
  const rowsByLane = {}
  const nodes = []
  let prev = null
  for (const it of sorted) {
    const lane = laneOf(it)
    const ends = (rowEnd[lane] ??= Array(rowCount[lane]).fill(-Infinity))
    const desired = !prev ? PAD_X : it.t === prev.t ? prev.x : prev.x + half + extra((it.t - prev.t) / HOUR) * zoom
    // The row where the card fits soonest; on a tie, the higher row.
    let row = 0
    let x = Infinity
    ends.forEach((end, r) => {
      const at = Math.max(desired, end)
      if (at < x - 0.5) { x = at; row = r }
    })
    ends[row] = x + step
    rowsByLane[lane] = Math.max(rowsByLane[lane] ?? 1, row + 1)
    prev = { id: it.id, t: it.t, x, row }
    nodes.push(prev)
  }
  const xById = new Map(nodes.map((n) => [n.id, n.x]))
  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  const tOf = (px) => {
    if (!nodes.length) return Date.now()
    const first = nodes[0]
    const last = nodes.at(-1)
    if (px <= first.x) return first.t - ((first.x - px) / step) * HOUR
    if (px >= last.x) return last.t + ((px - last.x) / step) * HOUR
    let i = 0
    while (nodes[i + 1].x <= px) i++
    const a = nodes[i], b = nodes[i + 1]
    if (b.t === a.t || b.x === a.x) return a.t
    return a.t + ((px - a.x) / (b.x - a.x)) * (b.t - a.t)
  }

  // A label at the first event of each calendar day, with a faint divider just before it.
  const days = []
  nodes.forEach((n, i) => {
    if (i === 0 || new Date(n.t).toDateString() !== new Date(nodes[i - 1].t).toDateString()) {
      days.push({ x: n.x, t: n.t, divider: i === 0 ? null : n.x - GAP / 2 })
    }
  })
  const gaps = []
  for (let i = 1; i < nodes.length; i++) {
    const dt = nodes[i].t - nodes[i - 1].t
    const from = nodes[i - 1].x + w
    if (dt > 18 * HOUR && nodes[i].x - from > 110) gaps.push({ from, to: nodes[i].x, label: humanGap(dt) })
  }

  const right = nodes.reduce((m, n) => Math.max(m, n.x), PAD_X)
  return { nodes, xById, nodeById, rowsByLane, tOf, days, gaps, width: right + w + PAD_X }
}

/** The zoom at which the whole timeline fits `available` px (0 if the tightest spacing is already too wide). */
export function fitZoom(items, available, scale = 1) {
  const { w, half } = cardSize(scale)
  const sorted = [...items].sort(byTime)
  if (sorted.length < 2) return 1
  let extras = 0
  let base = w + PAD_X * 2
  for (let i = 1; i < sorted.length; i++) {
    const dt = sorted[i].t - sorted[i - 1].t
    if (dt > 0) base += half
    extras += extra(dt / HOUR)
  }
  if (!extras) return 1
  return Math.min(2.5, Math.max(0, (available - base) / extras))
}

/** 'lanes': one lane per event type. 'single': everything in one lane. Each lane is as tall as its rows. */
export function laneLayout(mode, rowsByLane = {}, scale = 1) {
  const ids = mode === 'single' ? ['all'] : EVENT_TYPES.map((t) => t.id)
  const { h } = cardSize(scale)
  let y = AXIS_H
  const lanes = ids.map((id) => {
    const rows = Math.max(1, rowsByLane[id] ?? 1)
    const height = rows * h + (rows - 1) * ROW_GAP + LANE_PAD * 2
    const lane = { id, y, height, label: EVENT_TYPES.find((t) => t.id === id)?.label ?? null }
    y += height
    return lane
  })
  return { lanes, height: y }
}

/** Top edge of a card in `row` of `lane`. */
export const cardTop = (lane, row, scale = 1) => lane.y + LANE_PAD + row * (cardSize(scale).h + ROW_GAP)

export const snap = (t) => Math.round(t / SNAP_MS) * SNAP_MS

/**
 * The time to give `id` so that, once the whole axis is laid out again with
 * it there, its card's left edge lands at `targetX`. `place(t)` returns that
 * left edge for a trial time. `guess` (read off the frozen axis) wins when it
 * already lands close, since it keeps the time the juror pointed at. Otherwise
 * bisect: a later time never moves a card left. Snapped to SNAP_MS.
 */
export function timeAtX(items, id, targetX, place, guess) {
  const g = snap(guess)
  if (Math.abs(place(g) - targetX) <= 8) return g
  const others = items.filter((it) => it.id !== id)
  const ts = others.length ? others.map((it) => it.t) : [guess]
  const reach = 2 * 365 * 24 * HOUR
  let lo = Math.min(...ts) - reach
  let hi = Math.max(...ts) + reach
  // Out of reach (at zoom 0 the spacing ignores time): keep the guess.
  if (place(lo) >= targetX || place(hi) <= targetX) return g
  for (let i = 0; i < 48 && hi - lo > 1000; i++) {
    const mid = (lo + hi) / 2
    if (place(mid) < targetX) lo = mid
    else hi = mid
  }
  return snap(hi)
}
