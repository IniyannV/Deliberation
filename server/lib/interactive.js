import { bad } from './util.js';

/*
 * Interactive exhibits (maps and charts) are uploaded as JSON specs and
 * rendered by the client as SVG, never as HTML. Everything is validated and
 * rebuilt field by field here, so an exhibit can only contain the shapes,
 * numbers and plain-text labels listed below.
 *
 * Map:   { kind: "map", title, width, height, milesPerUnit?, areas[], roads[], layers[], features[] }
 *        areas: { kind: block|park|water|industrial, label?, points: [[x,y]…], labelAt?: [x,y] }
 * Chart: { kind: "chart", chart: "bar",    title, unit?, valuePrefix?, bars[] }
 *        { kind: "chart", chart: "events", title, rows[], categories[], points[], annotations[] }
 * See server/scripts/lib/interactive-exhibits.js for complete examples.
 */

const num = (v, field, min = -1e6, max = 1e6) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw bad(`${field} must be a number between ${min} and ${max}`);
  return n;
};
const text = (v, field, max = 200, optional = true) => {
  if (v === undefined || v === null || v === '') {
    if (optional) return '';
    throw bad(`${field} is required`);
  }
  if (typeof v !== 'string') throw bad(`${field} must be text`);
  if (v.length > max) throw bad(`${field} is too long (max ${max})`);
  return v.trim();
};
const id = (v, field) => {
  const s = text(v, field, 40, false);
  if (!/^[\w-]+$/.test(s)) throw bad(`${field} may only contain letters, numbers, - and _`);
  return s;
};
const list = (v, field, max) => {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > max) throw bad(`${field} must be a list of at most ${max} items`);
  return v;
};
const oneOf = (v, allowed, field, fallback) => (v === undefined && fallback ? fallback : allowed.includes(v) ? v : (() => { throw bad(`${field} must be one of ${allowed.join(', ')}`); })());
const iso = (v, field) => {
  const d = new Date(v);
  if (typeof v !== 'string' || Number.isNaN(d.getTime())) throw bad(`${field} must be a date/time`);
  return d.toISOString();
};

function points(v, field, w, h, min) {
  const pts = list(v, field, 400);
  if (pts.length < min) throw bad(`${field} needs at least ${min} points`);
  return pts.map((p, i) => {
    if (!Array.isArray(p) || p.length !== 2) throw bad(`${field}[${i}] must be [x, y]`);
    return [num(p[0], `${field} x`, 0, w), num(p[1], `${field} y`, 0, h)];
  });
}

const MARKER_ICONS = ['pin', 'store', 'warehouse', 'tower', 'police', 'home'];
const AREA_KINDS = ['block', 'park', 'water', 'industrial'];

function validateMap(s) {
  const width = num(s.width, 'width', 100, 4000);
  const height = num(s.height, 'height', 100, 4000);
  const layers = list(s.layers, 'layers', 10).map((l, i) => ({ id: id(l.id, `layers[${i}].id`), label: text(l.label, 'layer label', 60, false), on: l.on !== false }));
  const layerIds = new Set(layers.map((l) => l.id));
  const layerOf = (v) => {
    if (v === undefined || v === null || v === '') return null;
    if (!layerIds.has(v)) throw bad(`Unknown layer "${v}"`);
    return v;
  };
  const features = list(s.features, 'features', 300).map((f, i) => {
    const base = { id: id(f.id ?? `f${i}`, 'feature id'), layer: layerOf(f.layer), label: text(f.label, 'feature label', 80), detail: text(f.detail, 'feature detail', 800) };
    if (f.type === 'marker') {
      return {
        ...base,
        type: 'marker',
        x: num(f.x, 'marker x', 0, width),
        y: num(f.y, 'marker y', 0, height),
        icon: oneOf(f.icon, MARKER_ICONS, 'marker icon', 'pin'),
        time: text(f.time, 'marker time', 80),
        exhibits: list(f.exhibits, 'marker exhibits', 10).map((n) => text(n, 'exhibit number', 20, false)),
      };
    }
    if (f.type === 'circle') return { ...base, type: 'circle', x: num(f.x, 'circle x', 0, width), y: num(f.y, 'circle y', 0, height), r: num(f.r, 'circle radius', 1, 4000) };
    if (f.type === 'route') return { ...base, type: 'route', points: points(f.points, 'route', width, height, 2) };
    throw bad(`Feature ${i} has an unknown type`);
  });
  return {
    kind: 'map',
    title: text(s.title, 'title', 160, false),
    width,
    height,
    milesPerUnit: s.milesPerUnit === undefined ? null : num(s.milesPerUnit, 'milesPerUnit', 0.000001, 100),
    areas: list(s.areas, 'areas', 300).map((a) => ({
      kind: oneOf(a.kind, AREA_KINDS, 'area kind', 'block'),
      label: text(a.label, 'area label', 80),
      points: points(a.points, 'area', width, height, 3),
      labelAt: a.labelAt === undefined ? null : points([a.labelAt], 'area labelAt', width, height, 1)[0],
    })),
    roads: list(s.roads, 'roads', 300).map((r) => ({ label: text(r.label, 'road label', 80), major: !!r.major, points: points(r.points, 'road', width, height, 2) })),
    layers,
    features,
  };
}

function validateChart(s) {
  const title = text(s.title, 'title', 160, false);
  if (s.chart === 'bar') {
    return {
      kind: 'chart',
      chart: 'bar',
      title,
      unit: text(s.unit, 'unit', 30),
      valuePrefix: text(s.valuePrefix, 'valuePrefix', 4),
      bars: list(s.bars, 'bars', 40).map((b) => ({ label: text(b.label, 'bar label', 80, false), value: num(b.value, 'bar value', 0, 1e12), note: text(b.note, 'bar note', 300) })),
    };
  }
  if (s.chart === 'events') {
    // At most three categories: the validated colour slots for scatter-type charts.
    const rows = list(s.rows, 'rows', 6).map((r) => ({ id: id(r.id, 'row id'), label: text(r.label, 'row label', 80, false), detail: text(r.detail, 'row detail', 200) }));
    const categories = list(s.categories, 'categories', 3).map((c) => ({ id: id(c.id, 'category id'), label: text(c.label, 'category label', 40, false) }));
    const rowIds = new Set(rows.map((r) => r.id));
    const catIds = new Set(categories.map((c) => c.id));
    return {
      kind: 'chart',
      chart: 'events',
      title,
      rows,
      categories,
      points: list(s.points, 'points', 400).map((p) => {
        if (!rowIds.has(p.row)) throw bad(`Unknown row "${p.row}"`);
        if (!catIds.has(p.category)) throw bad(`Unknown category "${p.category}"`);
        return { t: iso(p.t, 'point time'), row: p.row, category: p.category, label: text(p.label, 'point label', 80, false), detail: text(p.detail, 'point detail', 300) };
      }),
      annotations: list(s.annotations, 'annotations', 30).map((a) => ({ t: iso(a.t, 'annotation time'), label: text(a.label, 'annotation label', 60, false) })),
    };
  }
  throw bad('chart must be "bar" or "events"');
}

export function validateInteractive(raw) {
  if (!raw || typeof raw !== 'object') throw bad('Interactive exhibit must be a JSON object');
  const spec = raw.kind === 'map' ? validateMap(raw) : raw.kind === 'chart' ? validateChart(raw) : (() => { throw bad('kind must be "map" or "chart"'); })();
  return spec;
}

/** Text the exhibit search should match: title, labels and details. */
export function interactiveSearchText(spec) {
  const parts = [spec.title];
  for (const f of spec.features ?? []) parts.push(f.label, f.detail, f.time);
  for (const a of spec.areas ?? []) parts.push(a.label);
  for (const r of spec.roads ?? []) parts.push(r.label);
  for (const b of spec.bars ?? []) parts.push(b.label, b.note);
  for (const p of spec.points ?? []) parts.push(p.label, p.detail);
  for (const r of spec.rows ?? []) parts.push(r.label, r.detail);
  for (const a of spec.annotations ?? []) parts.push(a.label);
  return parts.filter(Boolean).join(' ');
}
