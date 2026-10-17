import { useState } from 'react'
import { Icon } from '../../components/icons'
import { cx } from '../../components/ui'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'

/**
 * What the prosecution must prove for one count: the statute, a plain
 * summary, every element, key definitions and the burden of proof.
 * Each element is a checkbox a juror can tick as they weigh the evidence.
 * Ticks are private to that juror (never shown to others or logged).
 */
export default function ChargeDetails({ count, burden, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const checks = useLive((s) => s.personal.checks?.[count?.id])
  if (!count?.elements?.length) return null
  const ticked = new Set(checks ?? [])

  async function toggle(i) {
    const checked = !ticked.has(i)
    const live = useLive.getState()
    const next = checked ? [...ticked, i].sort((a, b) => a - b) : [...ticked].filter((x) => x !== i)
    useLive.setState({ personal: { ...live.personal, checks: { ...live.personal.checks, [count.id]: next } } })
    try {
      await live.emit('check:set', { countId: count.id, element: i, checked })
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }
  return (
    <section className="rounded-2xl bg-surface shadow-card">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-3.5 text-left hover:bg-fill/50">
        <span className="flex items-center gap-2 font-bold"><Icon name="shield" size={18} className="text-accent" /> What must be proven for a guilty verdict</span>
        <Icon name="chevronRight" size={18} strokeWidth={2.2} className={`text-muted transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-4 px-5 pb-5">
          <div>
            {count.statute && <p className="text-sm font-semibold text-muted">{count.statute}</p>}
            <p className="mt-1">{count.summary}</p>
          </div>
          <div>
            <p className="mb-1 font-semibold">To convict on this count, you must all agree the People proved <u>each</u> of these beyond a reasonable doubt:</p>
            <p className="mb-2 text-sm text-muted">
              Tick each one you are satisfied was proven. Only you see your ticks. {ticked.size} of {count.elements.length} ticked.
            </p>
            <ol className="flex flex-col gap-1">
              {count.elements.map((el, i) => {
                const on = ticked.has(i)
                return (
                  <li key={i}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(i)}
                      className="pressable pressable-soft -mx-2 flex w-[calc(100%+1rem)] gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-fill/60"
                    >
                      <span
                        className={cx(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors duration-200',
                          on ? 'border-ok bg-ok text-white' : 'border-accent/40 bg-accent-soft text-accent',
                        )}
                        aria-hidden
                      >
                        {on ? <Icon name="check" size={16} strokeWidth={3} /> : i + 1}
                      </span>
                      <span className={cx('pt-0.5', on && 'text-muted')}>
                        <span className="sr-only">Element {i + 1}: </span>{el}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
          {count.definitions?.length > 0 && (
            <dl className="flex flex-col gap-2 border-t border-line pt-3">
              {count.definitions.map((d) => (
                <div key={d.term}>
                  <dt className="font-semibold">{d.term}</dt>
                  <dd className="text-muted">{d.text}</dd>
                </div>
              ))}
            </dl>
          )}
          {burden && <p className="rounded-xl bg-warn-soft px-4 py-3 text-warn">{burden}</p>}
          <p className="text-sm text-muted">If you are unsure what an instruction means, the foreperson can send a question to the judge from Requests.</p>
        </div>
      )}
    </section>
  )
}
