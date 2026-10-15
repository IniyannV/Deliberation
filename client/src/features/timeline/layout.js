/*
 * Horizontal timeline geometry.
 *
 * Every event gets its own slot on the axis, in time order. Neighbouring
 * cards are always at least one card-width apart, so each lane is a single
 * line and cards never stack, plus extra space that grows with the log of
 * the time gap. Minutes apart reads as "close", weeks apart reads as "far",
 * without a linear scale making one of them unreadable. Between slots the
 * mapping is linear, so a pixel can be turned back into a time when dragging.
 */

import { EVENT_TYPES } from '../../lib/format'

const HOUR = 3600e3
export const CARD_W = 216
export const CARD_H = 118
export const GAP = 24
export const LANE_PAD = 14
export const AXIS_H = 72
export const PAD_X = 56
export const SNAP_MS = 5 * 60e3
const STEP = CARD_W + GAP

const extra = (dtH) => (dtH <= 0 ? 0 : 70 * Math.log2(1 + dtH))

export function humanGap(ms) {
  const h = ms / HOUR
  if (h < 48) return `${Math.round(h)} hours later`
  const d = Math.round(h / 24)
  if (d < 14) return `${d} days later`
  if (d < 60) return `${Math.round(d / 7)} weeks later`
  return `${Math.round(d / 30)} months later`
}

const byTime = (a, b) => a.t - b.t || a.id.localeCompare(b.id)

/** `items` are { id, t } (t in ms). `zoom` scales only the time-gap spacing; 0 means evenly spaced. */
export function buildAxis(items, zoom = 1) {
  const sorted = [...items].sort(byTime)
  const nodes = []
  let x = PAD_X
  sorted.forEach((it, i) => {
    if (i) x += STEP + extra((it.t - sorted[i - 1].t) / HOUR) * zoom
    nodes.push({ id: it.id, t: it.t, x })
  })
  const xById = new Map(nodes.map((n) => [n.id, n.x]))

  const tOf = (px) => {
    if (!nodes.length) return Date.now()
    const first = nodes[0]
    const last = nodes.at(-1)
    if (px <= first.x) return first.t - ((first.x - px) / STEP) * HOUR
    if (px >= last.x) return last.t + ((px - last.x) / STEP) * HOUR
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
    const from = nodes[i - 1].x + CARD_W
    if (dt > 18 * HOUR && nodes[i].x - from > 110) gaps.push({ from, to: nodes[i].x, label: humanGap(dt) })
  }

  return { nodes, xById, tOf, days, gaps, width: (nodes.at(-1)?.x ?? PAD_X) + CARD_W + PAD_X }
}

/** The zoom at which the whole timeline fits `available` px (0 if even spacing alone is too wide). */
export function fitZoom(items, available) {
  const sorted = [...items].sort(byTime)
  if (sorted.length < 2) return 1
  let extras = 0
  for (let i = 1; i < sorted.length; i++) extras += extra((sorted[i].t - sorted[i - 1].t) / HOUR)
  const base = (sorted.length - 1) * STEP + CARD_W + PAD_X * 2
  if (!extras) return 1
  return Math.min(2.5, Math.max(0, (available - base) / extras))
}

/** 'lanes': one row per event type. 'single': everything on one line. */
export function laneLayout(mode) {
  const ids = mode === 'single' ? ['all'] : EVENT_TYPES.map((t) => t.id)
  const h = CARD_H + LANE_PAD * 2
  return {
    lanes: ids.map((id, i) => ({ id, y: AXIS_H + i * h, height: h, label: EVENT_TYPES.find((t) => t.id === id)?.label ?? null })),
    height: AXIS_H + ids.length * h,
  }
}

export const snap = (t) => Math.round(t / SNAP_MS) * SNAP_MS
