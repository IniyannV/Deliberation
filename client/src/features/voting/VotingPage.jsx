import { useState } from 'react'
import { useAuth } from '../../store/auth'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { fmtDateTime } from '../../lib/format'
import { Badge, Button, Card, EmptyState, Field, IconButton, Input, Modal, PageHeader, Select, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import { VoteProgress, VoteResult } from './ResultsBars'
import ChargeDetails from './ChargeDetails'

const VOID_REASON = {
  server_restart: 'The court server restarted before every vote was in, so this vote was discarded unopened.',
  jury_changed: 'A juror was excused or an alternate was seated before every vote was in, so this vote was discarded unopened.',
  foreperson: 'The foreperson voided this ballot before it finished. No result was kept.',
}

const DEFAULT_OPTIONS = ['Leaning Guilty', 'Leaning Not Guilty', 'Undecided']

function OpenVoteCard({ vote, voted, isForeperson, count, burden }) {
  const emit = useLive((s) => s.emit)
  const [choice, setChoice] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const isBallot = vote.kind === 'ballot'

  async function cast() {
    setBusy(true)
    try {
      await emit('vote:cast', { id: vote.id, optionId: choice })
      setChoice('')
      setConfirming(false)
    } catch (err) {
      toast(err.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function act(event) {
    try { await emit(event, { id: vote.id }) } catch (err) { toast(err.message, { tone: 'error' }) }
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Badge tone={isBallot ? 'warn' : 'accent'}>{isBallot ? 'Secret ballot' : 'Poll'}</Badge>
          <h2 className="mt-2 text-2xl font-bold">{vote.question}</h2>
        </div>
        {isForeperson && (
          isBallot
            ? <Button size="sm" variant="danger" onClick={() => act('ballot:void')}>Void ballot</Button>
            : <Button size="sm" onClick={() => act('poll:close')}>Close poll &amp; show results</Button>
        )}
      </div>

      {voted ? (
        <p className="mb-5 flex items-center gap-2.5 rounded-2xl bg-ok-soft px-4 py-3 font-semibold text-ok">
          <Icon name="checkCircle" size={22} className="shrink-0" /> Your vote is recorded. Results appear when {isBallot ? 'every juror has voted' : 'everyone has voted or the foreperson closes the poll'}.
        </p>
      ) : (
        <fieldset className="mb-5">
          <legend className="sr-only">Your choice</legend>
          <div className="flex flex-wrap gap-3">
            {vote.options.map((o) => (
              <label key={o.id} className={cx('pressable pressable-soft flex min-w-48 flex-1 cursor-pointer items-center gap-3 rounded-2xl border-2 px-5 py-4 text-lg font-semibold', choice === o.id ? 'border-accent bg-accent-soft' : 'border-transparent bg-fill hover:bg-fill-strong')}>
                <input type="radio" name={`vote-${vote.id}`} value={o.id} checked={choice === o.id} onChange={() => setChoice(o.id)} className="h-5 w-5 accent-[var(--color-accent)]" />
                {o.label}
              </label>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Button variant="primary" size="lg" disabled={!choice || busy} onClick={() => (isBallot ? setConfirming(true) : cast())}>
              {isBallot ? 'Cast secret ballot' : 'Submit'}
            </Button>
            <p className="text-sm text-muted">{isBallot ? 'Anonymous. Your seat is never stored alongside your choice.' : 'Anonymous. Only totals are ever shown.'}</p>
          </div>
        </fieldset>
      )}

      {isBallot && <div className="mb-5"><ChargeDetails count={count} burden={burden} defaultOpen={!voted} /></div>}

      <VoteProgress vote={vote} />

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Cast your ballot?"
        footer={<>
          <Button variant="ghost" onClick={() => setConfirming(false)}>Go back</Button>
          <Button variant="primary" disabled={busy} onClick={cast}>Cast ballot</Button>
        </>}
      >
        <p className="text-lg">You are voting <b>{vote.options.find((o) => o.id === choice)?.label}</b> on {vote.question}.</p>
        <p className="mt-3 text-muted">Ballots are secret and can’t be changed once cast.</p>
      </Modal>
    </Card>
  )
}

function ForepersonPanel({ counts, votes }) {
  const emit = useLive((s) => s.emit)
  const [pollOpen, setPollOpen] = useState(false)
  const [question, setQuestion] = useState('Where are you leaning right now?')
  const [options, setOptions] = useState(DEFAULT_OPTIONS)
  const [countId, setCountId] = useState('')
  const autoProject = useLive((s) => s.autoProject)
  const [deliberatedInPerson, setDeliberatedInPerson] = useState(false)
  const pollIsOpen = votes.some((v) => v.kind === 'poll' && v.status === 'open')
  const ballotIsOpen = votes.some((v) => v.kind === 'ballot' && v.status === 'open')
  const hasStrawPoll = votes.some((v) => v.kind === 'poll')

  async function run(event, payload, after) {
    try {
      await emit(event, payload)
      after?.()
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  const canOpenBallot = Boolean(countId && !ballotIsOpen && (hasStrawPoll || deliberatedInPerson))

  return (
    <Card className="border-accent/40 p-6" data-tour="foreperson-panel">
      <div className="mb-4">
        <h2 className="flex items-center gap-2.5 text-xl font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-[0.55rem] bg-linear-to-b from-[#ff9f0a] to-[#ff7a00] text-white shadow-xs">
            <Icon name="shield" size={18} strokeWidth={2} />
          </span>
          Foreperson Deliberation Controls
        </h2>
        <p className="mt-0.5 text-sm text-muted">Manage chamber polls and formal ballots.</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Card 1: Informal Poll */}
        <div className="flex flex-col rounded-2xl border border-line/60 bg-fill/20 p-5 sm:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2.5 text-lg font-bold text-ink">
                <Icon name="list" size={19} /> Informal Straw Poll
              </h3>
              <Badge tone="accent">Non-binding</Badge>
            </div>
            <p className="max-w-2xl text-sm text-muted leading-relaxed">
              Gauge sentiment or identify sticking points across the room.
              Ask the jury any question with up to six options; results are a check-in only and never count toward a verdict.
            </p>
          </div>
          <div className="mt-5 flex justify-end border-t border-line/30 pt-4">
            <Button
              className="w-full sm:w-auto"
              icon="plus"
              disabled={pollIsOpen}
              onClick={() => setPollOpen(true)}
            >
              {pollIsOpen ? 'A poll is currently open' : 'New straw poll…'}
            </Button>
          </div>
        </div>

        {/* Card 2: Secret Ballot */}
        <div className="flex flex-col rounded-2xl border border-line/60 bg-fill/20 p-5 sm:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2.5 text-lg font-bold text-ink">
                <Icon name="vote" size={19} /> Formal Secret Ballot
              </h3>
              <Badge tone="warn">Binding</Badge>
            </div>
            <p className="max-w-2xl text-sm text-muted leading-relaxed">
              Official verdict vote on a count. Anonymity is guaranteed.
              Hold a straw poll or discuss the count in person first, then choose the count below to open the ballot.
            </p>
            <div className="mt-1 flex max-w-xl flex-col gap-3">
              <Select
                value={countId}
                onChange={(e) => {
                  setCountId(e.target.value)
                  setDeliberatedInPerson(false)
                }}
                aria-label="Count"
              >
                <option value="">Choose a count to vote on…</option>
                {counts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>

              {countId && !hasStrawPoll && (
                <div className="rounded-xl border border-line/50 bg-surface/80 p-3 text-sm">
                  <label className="flex items-start gap-2.5 cursor-pointer text-muted hover:text-ink">
                    <input
                      type="checkbox"
                      checked={deliberatedInPerson}
                      onChange={(e) => setDeliberatedInPerson(e.target.checked)}
                      className="mt-0.5 rounded border-line accent-[var(--color-accent)]"
                    />
                    <span>Jury has discussed elements in person without a straw poll</span>
                  </label>
                </div>
              )}
            </div>
          </div>
          <div className="mt-5 flex justify-end border-t border-line/30 pt-4">
            <Button
              className="w-full sm:w-auto"
              variant="primary"
              disabled={!canOpenBallot}
              onClick={() => run('ballot:open', { countId, showOnDisplay: autoProject }, () => {
                setCountId('')
                setDeliberatedInPerson(false)
              })}
            >
              {ballotIsOpen
                ? 'A ballot is open'
                : !countId
                ? 'Choose a count'
                : !canOpenBallot
                ? 'Discussion required'
                : 'Open formal ballot'}
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={pollOpen}
        onClose={() => setPollOpen(false)}
        title="New poll"
        footer={<>
          <Button variant="ghost" onClick={() => setPollOpen(false)}>Cancel</Button>
          <Button variant="primary" disabled={options.filter((o) => o.trim()).length < 2} onClick={() => run('poll:open', { question, options: options.filter((o) => o.trim()), showOnDisplay: autoProject }, () => setPollOpen(false))}>Open poll</Button>
        </>}
      >
        <div className="flex flex-col gap-4">
          <Field label="Question">{(id) => <Input id={id} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} />}</Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-semibold">Options</legend>
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} maxLength={60} aria-label={`Option ${i + 1}`} />
                <IconButton icon="x" label={`Remove option ${i + 1}`} disabled={options.length <= 2} onClick={() => setOptions(options.filter((_, j) => j !== i))} />
              </div>
            ))}
            {options.length < 6 && <Button size="sm" variant="ghost" icon="plus" className="self-start" onClick={() => setOptions([...options, ''])}>Add option</Button>}
          </fieldset>
        </div>
      </Modal>
    </Card>
  )
}

export default function VotingPage() {
  const user = useAuth((s) => s.user)
  const { votes, votedIn, counts, burden } = useLive()
  const isForeperson = user?.role === 'foreperson'
  const open = votes.filter((v) => v.status === 'open')
  const history = votes.filter((v) => v.status !== 'open').sort((a, b) => b.closedAt.localeCompare(a.closedAt))
  const countLabel = (id) => counts.find((c) => c.id === id)?.label

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Ballots and Charges"
        subtitle="Polls are informal check-ins. Ballots are formal and secret: the server records that you voted, separately from what you chose, and never links the two."
      />

      {isForeperson && <ForepersonPanel counts={counts} votes={votes} />}

      <section className="flex flex-col gap-5" data-tour="voting-open">
        <h2 className="text-xl font-bold">Open now</h2>
        {open.length ? (
          open.map((v) => <OpenVoteCard key={v.id} vote={v} voted={votedIn.includes(v.id)} isForeperson={isForeperson} count={counts.find((c) => c.id === v.countId)} burden={burden} />)
        ) : (
          <EmptyState icon="vote" title="Nothing to vote on right now">{isForeperson ? 'Use the controls above to open a poll or ballot.' : 'The foreperson will open a poll or ballot when the jury is ready.'}</EmptyState>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-xl font-bold">The charges</h2>
        <p className="mb-4 text-muted">Each count and what the People must prove. Open one to read it in full.</p>
        <div className="flex flex-col gap-3">
          {counts.map((c) => (
            <div key={c.id}>
              <h3 className="mb-1.5 font-bold">{c.label}</h3>
              <ChargeDetails count={c} burden={burden} defaultOpen={false} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xl font-bold">History</h2>
        <p className="mb-4 text-muted">Individual votes are never stored. Totals stay on the court server only until it shuts down; a secret ballot keeps just whether it was unanimous.</p>
        {history.length ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {history.map((v) => (
              <Card key={v.id} className="p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted">{v.kind === 'ballot' ? 'Secret ballot' : 'Poll'} · {fmtDateTime(v.closedAt)}</p>
                    <h3 className="font-bold">{v.kind === 'ballot' ? countLabel(v.countId) ?? v.question : v.question}</h3>
                  </div>
                  {v.status === 'voided' && <Badge tone="danger">Voided</Badge>}
                </div>
                {v.status === 'voided' ? (
                  <p className="text-muted">{VOID_REASON[v.voidReason] ?? VOID_REASON.foreperson}</p>
                ) : (
                  <>
                    <VoteResult vote={v} />
                    <p className="mt-3 text-sm text-muted">{v.votesCast} of {v.eligible} voted</p>
                  </>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted">No completed polls or ballots yet.</p>
        )}
      </section>
    </div>
  )
}
