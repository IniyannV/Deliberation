import { useState } from 'react'
import { useAuth } from '../../store/auth'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { fmtDateTime } from '../../lib/format'
import { Badge, Button, Card, EmptyState, Field, IconButton, Input, Modal, PageHeader, Segmented, Select, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import ResultsBars, { VoteProgress } from './ResultsBars'

const DEFAULT_OPTIONS = ['Leaning Guilty', 'Leaning Not Guilty', 'Undecided']

function OpenVoteCard({ vote, voted, isForeperson }) {
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
          <Badge tone={isBallot ? 'warn' : 'accent'}>{isBallot ? 'Secret ballot' : 'Temperature poll'}</Badge>
          <h2 className="mt-2 text-2xl font-bold">{vote.question}</h2>
        </div>
        {isForeperson && (
          isBallot
            ? <Button size="sm" variant="danger" onClick={() => act('ballot:void')}>Void ballot</Button>
            : <Button size="sm" onClick={() => act('poll:close')}>Close poll &amp; show results</Button>
        )}
      </div>

      {voted ? (
        <p className="mb-5 flex items-center gap-2 rounded-lg bg-ok-soft px-4 py-3 font-semibold text-ok">
          <Icon name="check" /> Your vote is recorded. Results appear when {isBallot ? 'every juror has voted' : 'everyone has voted or the foreperson closes the poll'}.
        </p>
      ) : (
        <fieldset className="mb-5">
          <legend className="sr-only">Your choice</legend>
          <div className="flex flex-wrap gap-3">
            {vote.options.map((o) => (
              <label key={o.id} className={cx('flex min-w-48 flex-1 cursor-pointer items-center gap-3 rounded-xl border-2 px-5 py-4 text-lg font-semibold', choice === o.id ? 'border-accent bg-accent-soft' : 'border-line hover:border-muted')}>
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

function ForepersonPanel({ counts, votes, display }) {
  const emit = useLive((s) => s.emit)
  const [pollOpen, setPollOpen] = useState(false)
  const [question, setQuestion] = useState('Where are you leaning right now?')
  const [options, setOptions] = useState(DEFAULT_OPTIONS)
  const [countId, setCountId] = useState('')
  const [showOnDisplay, setShowOnDisplay] = useState(true)
  const pollIsOpen = votes.some((v) => v.kind === 'poll' && v.status === 'open')
  const ballotIsOpen = votes.some((v) => v.kind === 'ballot' && v.status === 'open')

  async function run(event, payload, after) {
    try {
      await emit(event, payload)
      after?.()
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  const voteChoices = [...votes].reverse().filter((v) => v.status !== 'voided')

  return (
    <Card className="border-accent/40 p-6">
      <h2 className="mb-1 flex items-center gap-2 text-xl font-bold"><Icon name="shield" /> Foreperson controls</h2>
      <p className="mb-5 text-muted">Only the foreperson sees these controls.</p>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-3">
          <h3 className="font-bold">Temperature poll</h3>
          <p className="text-sm text-muted">A quick, informal check of where the room stands.</p>
          <Button icon="plus" disabled={pollIsOpen} onClick={() => setPollOpen(true)}>{pollIsOpen ? 'A poll is open' : 'New poll…'}</Button>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-bold">Secret ballot</h3>
          <Select value={countId} onChange={(e) => setCountId(e.target.value)} aria-label="Count">
            <option value="">Choose a count…</option>
            {counts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
          <Button
            variant="primary"
            disabled={!countId || ballotIsOpen}
            onClick={() => run('ballot:open', { countId, showOnDisplay }, () => setCountId(''))}
          >
            {ballotIsOpen ? 'A ballot is open' : 'Open ballot'}
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 font-bold"><Icon name="monitor" size={18} /> Room display</h3>
          <Segmented
            label="Room display shows"
            value={display.view}
            onChange={(view) => run('display:set', { view, voteId: display.voteId })}
            options={[{ value: 'timeline', label: 'Timeline' }, { value: 'votes', label: 'Votes' }, { value: 'calm', label: 'Calm screen' }]}
          />
          {display.view === 'votes' && (
            <Select value={display.voteId ?? ''} onChange={(e) => run('display:set', { view: 'votes', voteId: e.target.value || null })} aria-label="Vote shown on the display">
              <option value="">Latest vote</option>
              {voteChoices.map((v) => <option key={v.id} value={v.id}>{v.kind === 'ballot' ? 'Ballot' : 'Poll'}: {v.question.slice(0, 50)} ({fmtDateTime(v.openedAt)})</option>)}
            </Select>
          )}
        </div>
      </div>

      <label className="mt-5 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showOnDisplay} onChange={(e) => setShowOnDisplay(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
        Switch the room display to new polls and ballots automatically
      </label>

      <Modal
        open={pollOpen}
        onClose={() => setPollOpen(false)}
        title="New temperature poll"
        footer={<>
          <Button variant="ghost" onClick={() => setPollOpen(false)}>Cancel</Button>
          <Button variant="primary" disabled={options.filter((o) => o.trim()).length < 2} onClick={() => run('poll:open', { question, options: options.filter((o) => o.trim()), showOnDisplay }, () => setPollOpen(false))}>Open poll</Button>
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
  const { votes, votedIn, counts, display } = useLive()
  const isForeperson = user?.role === 'foreperson'
  const open = votes.filter((v) => v.status === 'open')
  const history = votes.filter((v) => v.status !== 'open').sort((a, b) => b.closedAt.localeCompare(a.closedAt))
  const countLabel = (id) => counts.find((c) => c.id === id)?.label

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Polls & ballots"
        subtitle="Polls are informal check-ins. Ballots are formal and secret: the server records that you voted, separately from what you chose, and never links the two."
      />

      {isForeperson && <ForepersonPanel counts={counts} votes={votes} display={display} />}

      <section className="flex flex-col gap-5">
        <h2 className="text-xl font-bold">Open now</h2>
        {open.length ? (
          open.map((v) => <OpenVoteCard key={v.id} vote={v} voted={votedIn.includes(v.id)} isForeperson={isForeperson} />)
        ) : (
          <EmptyState icon="vote" title="Nothing to vote on right now">{isForeperson ? 'Use the controls above to open a poll or ballot.' : 'The foreperson will open a poll or ballot when the jury is ready.'}</EmptyState>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-xl font-bold">History</h2>
        <p className="mb-4 text-muted">Only totals and times are kept. Individual votes are never stored.</p>
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
                  <p className="text-muted">{v.voidReason === 'server_restart' ? 'The court server restarted before every vote was in, so this ballot was discarded unopened.' : 'The foreperson voided this ballot before it finished. No result was kept.'}</p>
                ) : (
                  <>
                    <ResultsBars vote={v} />
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
