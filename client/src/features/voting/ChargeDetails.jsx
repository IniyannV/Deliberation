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
function getElementStatus(checks, idx) {
  if (Array.isArray(checks)) return checks.includes(idx) ? 'proven' : 'unproven'
  if (checks && typeof checks === 'object') return checks[idx] || 'unproven'
  return 'unproven'
}

export default function ChargeDetails({ count, burden, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const checks = useLive((s) => s.personal.checks?.[count?.id])
  if (!count?.elements?.length) return null

  const provenCount = count.elements.filter((_, i) => getElementStatus(checks, i) === 'proven').length
  const disputedCount = count.elements.filter((_, i) => getElementStatus(checks, i) === 'disputed').length

  async function cycleStatus(i) {
    const current = getElementStatus(checks, i)
    const nextState = current === 'unproven' ? 'disputed' : current === 'disputed' ? 'proven' : 'unproven'
    const live = useLive.getState()
    const currentMap = typeof live.personal?.checks?.[count.id] === 'object' && !Array.isArray(live.personal?.checks?.[count.id])
      ? { ...live.personal?.checks?.[count.id] }
      : {}
    if (nextState === 'unproven') delete currentMap[i]
    else currentMap[i] = nextState

    useLive.setState({ personal: { ...live.personal, checks: { ...live.personal.checks, [count.id]: currentMap } } })
    try {
      await live.emit('check:set', { countId: count.id, element: i, state: nextState })
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  return (
    <section className="rounded-2xl bg-surface shadow-card">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-3.5 text-left hover:bg-fill/50">
        <span className="flex items-center gap-2 font-bold"><Icon name="shield" size={18} className="text-accent" /> What must be proven for a guilty verdict</span>
        <div className="flex items-center gap-2">
          {provenCount === count.elements.length ? (
            <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok">All {count.elements.length} proven</span>
          ) : disputedCount > 0 ? (
            <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-semibold text-warn">{disputedCount} disputed · {provenCount}/{count.elements.length} proven</span>
          ) : provenCount > 0 ? (
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">{provenCount}/{count.elements.length} proven</span>
          ) : null}
          <Icon name="chevronRight" size={18} strokeWidth={2.2} className={`text-muted transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
        </div>
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
              Tap an element to cycle through: <b>Pending</b> → <b className="text-warn">Under Deliberation</b> → <b className="text-ok">Proven</b>. Private to your seat.
            </p>
            <ol className="flex flex-col gap-2">
              {count.elements.map((el, i) => {
                const status = getElementStatus(checks, i)
                return (
                  <li key={i}>
                    <button
                      type="button"
                      role="button"
                      onClick={() => cycleStatus(i)}
                      className={cx(
                        'pressable pressable-soft -mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-xl p-2.5 text-left border transition-all',
                        status === 'proven'
                          ? 'border-ok/30 bg-ok-soft/30 hover:bg-ok-soft/50'
                          : status === 'disputed'
                          ? 'border-warn/30 bg-warn-soft/30 hover:bg-warn-soft/50'
                          : 'border-transparent hover:bg-fill/60',
                      )}
                    >
                      <span
                        className={cx(
                          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-bold transition-colors duration-200',
                          status === 'proven'
                            ? 'border-ok bg-ok text-white'
                            : status === 'disputed'
                            ? 'border-warn bg-warn text-white'
                            : 'border-line bg-surface text-muted',
                        )}
                        aria-hidden
                      >
                        {status === 'proven' ? (
                          <Icon name="check" size={15} strokeWidth={3} />
                        ) : status === 'disputed' ? (
                          '?'
                        ) : (
                          i + 1
                        )}
                      </span>
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-muted">Element {i + 1}</span>
                          <span
                            className={cx(
                              'rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide uppercase',
                              status === 'proven'
                                ? 'bg-ok-soft text-ok'
                                : status === 'disputed'
                                ? 'bg-warn-soft text-warn'
                                : 'bg-fill text-muted',
                            )}
                          >
                            {status === 'proven' ? 'Proven' : status === 'disputed' ? 'Under Deliberation' : 'Pending'}
                          </span>
                        </div>
                        <p className="text-sm leading-snug text-ink">{el}</p>
                      </div>
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
