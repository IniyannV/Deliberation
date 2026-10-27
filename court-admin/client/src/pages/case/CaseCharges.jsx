import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api, isDemoAdminDomain } from '../../lib/api'
import { toast } from '../../store/ui'
import { Button, Card, EmptyState, ErrorText, Field, IconButton, Input, Modal, Select, Textarea } from '../../components/ui'
import { TEXAS_OFFENSES, TEXAS_OFFENSE_GROUPS, offenseOf } from '../../lib/texasOffenses'

// A new count gets its id here, so it keeps its place while being reordered. The server keeps it.
// (Not crypto.randomUUID: office PCs reach the app over plain HTTP, where it is unavailable.)
const hasContent = (c) => !!(c.statute || c.summary || c.elements.some(Boolean) || c.definitions.length)

const blankCount = (n) => ({ id: `count_${Math.random().toString(36).slice(2, 12)}`, label: `Count ${n}: `, statute: '', summary: '', elements: [''], definitions: [] })

/**
 * The counts (charges) jurors vote on, each with the elements the
 * prosecution must prove and any legal definitions. Jurors see these beside
 * every ballot, so they should match the judge's written instructions word
 * for word. Edits are kept here until saved.
 */
export default function CaseCharges() {
  const { kase, setCase } = useOutletContext()
  const [counts, setCounts] = useState(kase.counts)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [replacing, setReplacing] = useState(null) // { i, offense }: a filled-in count about to be overwritten
  const dirty = JSON.stringify(counts) !== JSON.stringify(kase.counts)

  const update = (i, patch) => setCounts(counts.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  // Fill a count from the Texas offense list. Elements and definitions are copies, so editing one count leaves the list alone.
  const fill = (i, o) => {
    update(i, { label: `Count ${i + 1}: ${o.name}`, statute: o.statute, summary: o.summary, elements: [...o.elements], definitions: o.definitions.map((d) => ({ ...d })) })
    setReplacing(null)
  }
  const choose = (i, key) => {
    const o = TEXAS_OFFENSES.find((x) => x.key === key)
    if (!o) return
    if (hasContent(counts[i])) setReplacing({ i, offense: o })
    else fill(i, o)
  }
  const move = (i, dir) => {
    const next = [...counts]
    ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
    setCounts(next)
  }

  async function save() {
    setBusy(true)
    setError('')
    try {
      const { case: c } = await api(`/cases/${kase.id}/counts`, { method: 'PUT', body: { counts } })
      setCase(c)
      setCounts(c.counts)
      toast('Charges saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-2 mb-4 flex flex-wrap items-center gap-3 bg-bg/90 px-2 py-2 backdrop-blur">
        <Button
          variant="primary"
          onClick={save}
          disabled={busy || !dirty}
        >
          Save charges
        </Button>
        <Button
          icon="plus"
          onClick={() => setCounts([...counts, blankCount(counts.length + 1)])}
        >
          Add count
        </Button>
        {dirty && <span className="text-sm text-warn">Unsaved changes</span>}
        <p className="ml-auto text-sm text-muted">Copy each count from the judge’s written instructions.</p>
      </div>
      <ErrorText>{error}</ErrorText>

      {!counts.length && <Card><EmptyState icon="list" title="No counts yet">Add each charge the jury will decide, with its elements.</EmptyState></Card>}

      <div className="flex flex-col gap-5">
        {counts.map((c, i) => (
          <Card key={c.id} className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Count {i + 1}</h2>
              <div className="flex gap-1">
                <IconButton icon="chevronLeft" label="Move up" className="rotate-90" disabled={i === 0} onClick={() => move(i, -1)} />
                <IconButton icon="chevronRight" label="Move down" className="rotate-90" disabled={i === counts.length - 1} onClick={() => move(i, 1)} />
                <IconButton icon="trash" label={`Remove count ${i + 1}`} className="hover:text-danger" onClick={() => setCounts(counts.filter((_, j) => j !== i))} />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <Field label="Texas offense" hint="Fills in the statute, summary, elements and definitions. Edit them to match the judge’s charge.">
                {(id) => (
                  <Select id={id} value={offenseOf(c)} onChange={(e) => choose(i, e.target.value)}>
                    <option value="">Custom, or choose an offense…</option>
                    {TEXAS_OFFENSE_GROUPS.map((g) => (
                      <optgroup key={g} label={g}>
                        {TEXAS_OFFENSES.filter((o) => o.group === g).map((o) => <option key={o.key} value={o.key}>{o.name} ({o.statute.replace(/^Texas /, '')})</option>)}
                      </optgroup>
                    ))}
                  </Select>
                )}
              </Field>
              <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
                <Field label="Label" hint="Shown on the ballot, e.g. Count 1: Burglary in the Third Degree">{(id) => <Input id={id} value={c.label} onChange={(e) => update(i, { label: e.target.value })} maxLength={200} />}</Field>
                <Field label="Statute">{(id) => <Input id={id} value={c.statute} onChange={(e) => update(i, { statute: e.target.value })} maxLength={200} />}</Field>
              </div>
              <Field label="Summary">{(id) => <Textarea id={id} value={c.summary} onChange={(e) => update(i, { summary: e.target.value })} maxLength={2000} className="min-h-20" />}</Field>

              <fieldset>
                <legend className="mb-2 px-1 text-sm font-semibold text-muted">Elements the prosecution must prove</legend>
                <ol className="flex flex-col gap-2">
                  {c.elements.map((el, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <span className="mt-2 w-6 shrink-0 text-right font-semibold text-muted tabular-nums">{j + 1}.</span>
                      <Textarea value={el} onChange={(e) => update(i, { elements: c.elements.map((x, k) => (k === j ? e.target.value : x)) })} maxLength={1000} className="min-h-12" aria-label={`Count ${i + 1}, element ${j + 1}`} />
                      <IconButton icon="x" label={`Remove element ${j + 1}`} onClick={() => update(i, { elements: c.elements.filter((_, k) => k !== j) })} />
                    </li>
                  ))}
                </ol>
                <Button size="sm" variant="ghost" icon="plus" className="mt-2" onClick={() => update(i, { elements: [...c.elements, ''] })}>Add element</Button>
              </fieldset>

              <fieldset>
                <legend className="mb-2 px-1 text-sm font-semibold text-muted">Definitions</legend>
                <div className="flex flex-col gap-2">
                  {c.definitions.map((d, j) => (
                    <div key={j} className="grid grid-cols-[14rem_1fr_auto] items-start gap-2">
                      <Input value={d.term} onChange={(e) => update(i, { definitions: c.definitions.map((x, k) => (k === j ? { ...x, term: e.target.value } : x)) })} placeholder="Term" maxLength={120} aria-label="Term" />
                      <Textarea value={d.text} onChange={(e) => update(i, { definitions: c.definitions.map((x, k) => (k === j ? { ...x, text: e.target.value } : x)) })} placeholder="Definition" maxLength={2000} className="min-h-12" aria-label="Definition" />
                      <IconButton icon="x" label={`Remove definition ${j + 1}`} onClick={() => update(i, { definitions: c.definitions.filter((_, k) => k !== j) })} />
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="ghost" icon="plus" className="mt-2" onClick={() => update(i, { definitions: [...c.definitions, { term: '', text: '' }] })}>Add definition</Button>
              </fieldset>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!replacing} onClose={() => setReplacing(null)} title={`Replace count ${(replacing?.i ?? 0) + 1}?`} footer={<><Button variant="ghost" onClick={() => setReplacing(null)}>Cancel</Button><Button variant="primary" onClick={() => fill(replacing.i, replacing.offense)}>Replace</Button></>}>
        <p>This count’s label, statute, summary, elements and definitions are replaced with those for <b>{replacing?.offense.name}</b>. Nothing is saved until you choose Save charges.</p>
      </Modal>
    </div>
  )
}
