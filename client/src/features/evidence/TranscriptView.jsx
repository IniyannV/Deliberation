import { Fragment, useEffect, useMemo, useRef } from 'react'
import { Icon } from '../../components/icons'
import { cx } from '../../components/ui'

function highlight(text, terms) {
  if (!terms.length) return text
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return text.split(re).map((part, i) =>
    i % 2 ? <mark key={i} className="rounded bg-warn-soft px-0.5 text-ink">{part}</mark> : <Fragment key={i}>{part}</Fragment>,
  )
}

/**
 * Numbered transcript lines. Optional features:
 *  - links / onOpenExhibit: show "→ P-3" chips that jump to an exhibit
 *  - selection / onSelect: click a line number to select; shift-click for a range
 *  - onLink(line): show a "link exhibit" button on hover
 *  - focusLine: scroll to and briefly mark a line
 */
export default function TranscriptView({
  exhibit, query = '', links = [], exhibitsById = {}, onOpenExhibit, onUnlink,
  selection, onSelect, onLink, focusLine, large = false,
}) {
  const terms = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query])
  const refs = useRef({})

  useEffect(() => {
    if (focusLine) refs.current[focusLine]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusLine, exhibit?.id])

  const linksByLine = useMemo(() => {
    const m = {}
    for (const l of links) if (l.transcriptId === exhibit.id) (m[l.line] ??= []).push(l)
    return m
  }, [links, exhibit.id])

  const inSel = (n) => selection && n >= selection.from && n <= selection.to

  return (
    <ol className={cx('flex flex-col', large ? 'text-lg' : '')} aria-label={`${exhibit.number} transcript`}>
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
                className="w-9 shrink-0 self-start pt-0.5 text-right font-mono text-sm text-muted tabular-nums hover:text-accent"
                aria-label={`Select line ${l.n}${selection ? '. Shift-click to select a range.' : ''}`}
                aria-pressed={!!inSel(l.n)}
              >
                {l.n}
              </button>
            ) : (
              <span className="w-9 shrink-0 self-start pt-0.5 text-right font-mono text-sm text-muted tabular-nums">{l.n}</span>
            )}
            <p className="flex-1">
              {l.speaker && <span className="mr-2 font-bold">{l.speaker}:</span>}
              {highlight(l.text, terms)}
              {(linksByLine[l.n] ?? []).map((lk) => {
                const ex = exhibitsById[lk.exhibitId]
                if (!ex) return null
                return (
                  <span key={lk.id} className="ml-2 inline-flex items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
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
                className="shrink-0 self-start rounded-md p-1 text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-surface hover:text-accent"
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
  )
}
