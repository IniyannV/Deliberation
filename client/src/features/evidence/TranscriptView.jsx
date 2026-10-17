import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../components/icons'
import { cx } from '../../components/ui'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'

function searchMarks(text, terms, keyPrefix = '') {
  if (!terms.length) return text
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return text.split(re).map((part, i) =>
    i % 2 ? <mark key={`${keyPrefix}${i}`} className="rounded bg-warn-soft px-0.5 text-ink">{part}</mark> : <Fragment key={`${keyPrefix}${i}`}>{part}</Fragment>,
  )
}

/* Highlight ranges are [start, end) character offsets into a line's text, kept sorted and non-overlapping. */
function addRange(ranges, [a, b]) {
  const out = []
  for (const [s, e] of [...ranges, [a, b]].sort((x, y) => x[0] - y[0])) {
    const last = out.at(-1)
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else out.push([s, e])
  }
  return out
}
function removeRange(ranges, [a, b]) {
  const out = []
  for (const [s, e] of ranges) {
    if (e <= a || s >= b) out.push([s, e])
    else {
      if (s < a) out.push([s, a])
      if (e > b) out.push([b, e])
    }
  }
  return out
}
const covers = (ranges, [a, b]) => ranges.some(([s, e]) => s <= a && e >= b)
const overlaps = (ranges, [a, b]) => ranges.some(([s, e]) => s < b && e > a)

/** A line's text with highlighter marks, and search matches marked inside them. */
function renderLine(text, terms, ranges = []) {
  if (!ranges.length) return searchMarks(text, terms)
  const parts = []
  let at = 0
  ranges.forEach(([s, e], i) => {
    if (s > at) parts.push(<Fragment key={`t${i}`}>{searchMarks(text.slice(at, s), terms, `t${i}-`)}</Fragment>)
    parts.push(<mark key={`h${i}`} className="hl">{searchMarks(text.slice(s, e), terms, `h${i}-`)}</mark>)
    at = e
  })
  if (at < text.length) parts.push(<Fragment key="end">{searchMarks(text.slice(at), terms, 'end-')}</Fragment>)
  return parts
}

/** Character offset of a DOM position within `el`'s text. */
function offsetIn(el, node, offset) {
  const r = document.createRange()
  r.setStart(el, 0)
  r.setEnd(node, offset)
  return r.toString().length
}

/** The part of each line's text that the current selection covers: { [line]: [start, end] }. */
function selectedSpans(root) {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer) && !range.intersectsNode(root)) return null
  const spans = {}
  for (const el of root.querySelectorAll('[data-hl-line]')) {
    if (!range.intersectsNode(el)) continue
    const len = el.textContent.length
    const s = el.contains(range.startContainer) ? offsetIn(el, range.startContainer, range.startOffset) : 0
    const e = el.contains(range.endContainer) ? offsetIn(el, range.endContainer, range.endOffset) : len
    if (e > s) spans[el.dataset.hlLine] = [Math.max(0, s), Math.min(len, e)]
  }
  return Object.keys(spans).length ? spans : null
}

/**
 * Numbered transcript lines. Optional features:
 *  - links / onOpenExhibit: show "→ P-3" chips that jump to an exhibit
 *  - selection / onSelect: click a line number to select; shift-click for a range
 *  - onLink(line): show a "link exhibit" button on hover
 *  - focusLine: scroll to and briefly mark a line
 * Jurors can also select text (press and hold on an iPad) and highlight it.
 * Highlights are private to each juror and follow them across devices.
 */
export default function TranscriptView({
  exhibit, query = '', links = [], exhibitsById = {}, onOpenExhibit, onUnlink,
  selection, onSelect, onLink, focusLine, large = false,
}) {
  const terms = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query])
  const refs = useRef({})
  const root = useRef(null)
  const role = useLive((s) => s.role)
  const canHighlight = role === 'juror' || role === 'foreperson'
  const mine = useLive((s) => s.personal.highlights?.[exhibit.id])
  const highlights = useMemo(() => mine ?? {}, [mine])
  const [bar, setBar] = useState(null) // { spans, x, y } while text is selected

  useEffect(() => {
    if (focusLine) refs.current[focusLine]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusLine, exhibit?.id])

  // Follow the text selection and offer to highlight it.
  useEffect(() => {
    if (!canHighlight) return
    let hide
    const update = () => {
      const spans = root.current && selectedSpans(root.current)
      clearTimeout(hide)
      if (!spans) {
        // A beat of grace, so tapping the toolbar (which can clear the selection) still lands.
        hide = setTimeout(() => setBar(null), 300)
        return
      }
      const rect = window.getSelection().getRangeAt(0).getBoundingClientRect()
      setBar({ spans, x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom })
    }
    document.addEventListener('selectionchange', update)
    return () => {
      clearTimeout(hide)
      document.removeEventListener('selectionchange', update)
    }
  }, [canHighlight])

  useEffect(() => {
    if (!bar) return
    const away = () => setBar(null)
    window.addEventListener('scroll', away, true)
    return () => window.removeEventListener('scroll', away, true)
  }, [bar])

  async function apply(remove) {
    const lines = {}
    for (const [n, span] of Object.entries(bar.spans)) {
      const current = highlights[n] ?? []
      lines[n] = remove ? removeRange(current, span) : addRange(current, span)
    }
    window.getSelection()?.removeAllRanges()
    setBar(null)
    // Show it at once; the server echoes the saved copy to every device this juror uses.
    const live = useLive.getState()
    const next = { ...highlights }
    for (const [n, r] of Object.entries(lines)) { if (r.length) next[n] = r; else delete next[n] }
    useLive.setState({ personal: { ...live.personal, highlights: { ...live.personal.highlights, [exhibit.id]: next } } })
    try {
      await live.emit('highlight:set', { transcriptId: exhibit.id, lines })
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  const linksByLine = useMemo(() => {
    const m = {}
    for (const l of links) if (l.transcriptId === exhibit.id) (m[l.line] ??= []).push(l)
    return m
  }, [links, exhibit.id])

  const inSel = (n) => selection && n >= selection.from && n <= selection.to
  const spans = bar ? Object.entries(bar.spans) : []
  const canAdd = spans.some(([n, s]) => !covers(highlights[n] ?? [], s))
  const canRemove = spans.some(([n, s]) => overlaps(highlights[n] ?? [], s))

  return (
    <>
      <ol ref={root} className={cx('flex flex-col', large ? 'text-lg' : '')} aria-label={`${exhibit.number} transcript`}>
        {exhibit.lines.map((l) => {
          const hit = terms.length && terms.some((t) => `${l.speaker ?? ''} ${l.text}`.toLowerCase().includes(t))
          return (
            <li
              key={l.n}
              ref={(el) => { refs.current[l.n] = el }}
              className={cx(
                'group flex gap-3 rounded-md px-2 py-1.5',
                inSel(l.n) ? 'bg-accent-soft' : focusLine === l.n ? 'bg-warn-soft' : hit ? 'bg-surface-2' : 'hover:bg-surface-2/60',
              )}
            >
              {onSelect ? (
                <button
                  type="button"
                  onClick={(e) => onSelect(l.n, e.shiftKey)}
                  className="no-callout w-9 shrink-0 self-start pt-0.5 text-right font-mono text-sm text-muted tabular-nums hover:text-accent"
                  aria-label={`Select line ${l.n}${selection ? '. Shift-click to select a range.' : ''}`}
                  aria-pressed={!!inSel(l.n)}
                >
                  {l.n}
                </button>
              ) : (
                <span className="no-callout w-9 shrink-0 self-start pt-0.5 text-right font-mono text-sm text-muted tabular-nums">{l.n}</span>
              )}
              <p className="flex-1">
                {l.speaker && <span className="mr-2 font-bold">{l.speaker}:</span>}
                <span data-hl-line={l.n}>{renderLine(l.text, terms, highlights[l.n])}</span>
                {(linksByLine[l.n] ?? []).map((lk) => {
                  const ex = exhibitsById[lk.exhibitId]
                  if (!ex) return null
                  return (
                    <span key={lk.id} className="no-callout ml-2 inline-flex items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                      <button type="button" onClick={() => onOpenExhibit?.(lk.exhibitId)} className="inline-flex items-center gap-1 py-0.5 pl-2.5 pr-1.5 hover:underline" title={`Open ${ex.number}: ${ex.title}`}>
                        <Icon name="link" size={14} /> {ex.number}
                      </button>
                      {onUnlink && (
                        <button type="button" onClick={() => onUnlink(lk.id)} className="rounded-full p-0.5 pr-1.5 opacity-60 hover:opacity-100" aria-label={`Remove link to ${ex.number}`}>
                          <Icon name="x" size={12} />
                        </button>
                      )}
                    </span>
                  )
                })}
              </p>
              {onLink && (
                <button
                  type="button"
                  onClick={() => onLink(l.n)}
                  className="shrink-0 self-start rounded-md p-1 text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-surface hover:text-accent [@media(hover:none)]:opacity-60"
                  aria-label={`Link line ${l.n} to an exhibit`}
                  title="Link this line to an exhibit"
                >
                  <Icon name="link" size={16} />
                </button>
              )}
            </li>
          )
        })}
      </ol>

      {/* Below the selection, so it doesn't fight the iPad's own edit menu above it. */}
      {bar && (canAdd || canRemove) && createPortal(
        <div
          role="toolbar"
          aria-label="Highlight"
          className="material materialize fixed z-[70] flex -translate-x-1/2 gap-1 rounded-full p-1"
          style={{ left: Math.min(window.innerWidth - 120, Math.max(120, bar.x)), top: Math.min(window.innerHeight - 64, bar.bottom + 12) }}
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
        >
          {canAdd && (
            <button type="button" onClick={() => apply(false)} className="pressable flex items-center gap-1.5 rounded-full bg-[#ffd60a] px-3.5 py-1.5 text-sm font-semibold text-black">
              <Icon name="highlighter" size={16} strokeWidth={2} /> Highlight
            </button>
          )}
          {canRemove && (
            <button type="button" onClick={() => apply(true)} className="pressable flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold text-ink hover:bg-fill">
              <Icon name="x" size={16} strokeWidth={2} /> Remove highlight
            </button>
          )}
        </div>,
        // Inside a full-screen exhibit, only its own subtree is shown.
        document.fullscreenElement ?? document.webkitFullscreenElement ?? document.body,
      )}
    </>
  )
}
