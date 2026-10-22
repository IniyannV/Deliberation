import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { fmtDateTime } from '../../lib/format'
import { Button } from '../../components/ui'

// Slips per printed page: two columns of five fit Letter and A4.
const PER_PAGE = 10

/**
 * PINs just generated, as a sheet to print and cut into slips. They exist
 * only in this browser tab: the server keeps hashes, so once this closes
 * they can't be shown again (only replaced). Each page carries the case
 * header, so a bulk print of many slips stays sorted by case.
 */
export default function PinSheet({ kase, pins, onClose }) {
  // The printed page carries no browser header or footer (see index.css); the
  // title is the file name if it's saved as a PDF.
  useEffect(() => {
    const title = document.title
    document.title = `${kase.caseNumber} jury PINs`
    document.body.classList.add('printing-sheet')
    return () => {
      document.title = title
      document.body.classList.remove('printing-sheet')
    }
  }, [kase.caseNumber])

  const generated = useMemo(() => fmtDateTime(new Date()), [])
  const pages = []
  for (let i = 0; i < pins.length; i += PER_PAGE) pages.push(pins.slice(i, i + PER_PAGE))

  return createPortal(
    <div className="print-sheet fixed inset-0 z-40 overflow-y-auto bg-bg">
      <div className="print-frame mx-auto max-w-3xl px-8 py-10">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warn-soft px-5 py-4 text-warn">
          <p className="max-w-lg font-medium">Print this sheet now. These {pins.length} PIN{pins.length === 1 ? ' is' : 's are'} not saved anywhere and can’t be shown again; you could only generate new ones.</p>
          <div className="flex gap-2">
            <Button variant="primary" icon="printer" onClick={() => window.print()}>Print{pages.length > 1 ? ` ${pages.length} pages` : ''}</Button>
            <Button onClick={onClose}>I’ve printed it</Button>
          </div>
        </div>

        {pages.map((page, n) => (
          <section key={n} className="print-page mb-10 last:mb-0">
            <header className="mb-5">
              <p className="text-sm font-semibold text-muted">Jury-room sign-in PINs · Confidential{pages.length > 1 && ` · Page ${n + 1} of ${pages.length}`}</p>
              <h1 className="text-2xl font-bold">{kase.caption}</h1>
              <p className="text-muted">{kase.caseNumber}{kase.court && ` · ${kase.court}`} · Generated {generated}</p>
            </header>

            <ul className="grid grid-cols-2 gap-3">
              {page.map((p) => (
                <li key={p.signIn} className="pin-slip break-inside-avoid rounded-xl border-2 border-dashed border-line p-4">
                  <p className="truncate text-sm text-muted">{p.who}</p>
                  <p className="mt-1 flex items-baseline justify-between gap-3">
                    <span>Sign in: <b className="text-lg">{p.signIn}</b></span>
                    <span>PIN: <b className="font-mono text-2xl tracking-[0.2em]">{p.pin}</b></span>
                  </p>
                </li>
              ))}
            </ul>
            {n === pages.length - 1 && <p className="mt-6 text-sm text-muted">Cut along the dashed lines and hand each slip to its juror privately. The bailiff can reset a lost PIN on the jury laptop.</p>}
          </section>
        ))}
      </div>
    </div>,
    document.getElementById('root'),
  )
}
