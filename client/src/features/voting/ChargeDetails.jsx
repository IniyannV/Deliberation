import { useState } from 'react'
import { Icon } from '../../components/icons'

/**
 * What the prosecution must prove for one count: the statute, a plain
 * summary, every element, key definitions and the burden of proof.
 */
export default function ChargeDetails({ count, burden, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!count?.elements?.length) return null
  return (
    <section className="rounded-xl border border-line bg-surface-2/60">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left">
        <span className="flex items-center gap-2 font-bold"><Icon name="shield" size={18} /> What must be proven for a guilty verdict</span>
        <Icon name={open ? 'minus' : 'plus'} size={18} className="text-muted" />
      </button>
      {open && (
        <div className="flex flex-col gap-4 px-5 pb-5">
          <div>
            {count.statute && <p className="text-sm font-semibold text-muted">{count.statute}</p>}
            <p className="mt-1">{count.summary}</p>
          </div>
          <div>
            <p className="mb-2 font-semibold">To convict on this count, you must all agree the People proved <u>each</u> of these beyond a reasonable doubt:</p>
            <ol className="flex flex-col gap-2">
              {count.elements.map((el, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">{i + 1}</span>
                  <span className="pt-0.5">{el}</span>
                </li>
              ))}
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
          {burden && <p className="rounded-lg bg-warn-soft px-4 py-3 text-warn">{burden}</p>}
          <p className="text-sm text-muted">If you are unsure what an instruction means, the foreperson can send a question to the judge from Requests.</p>
        </div>
      )}
    </section>
  )
}
