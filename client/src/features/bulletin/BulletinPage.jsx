import { api } from '../../lib/api'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { fmtDateTime } from '../../lib/format'
import { Badge, Button, Card, EmptyState, PageHeader, cx } from '../../components/ui'
import { Icon } from '../../components/icons'

/*
 * One-way family updates. There is deliberately no reply UI. The server
 * has no reply endpoint either.
 */
export default function BulletinPage() {
  const updates = useLive((s) => s.updates)

  async function markRead(id) {
    try {
      const { readAt } = await api(`/updates/${id}/read`, { method: 'POST' })
      useLive.setState((s) => ({ updates: s.updates.map((u) => (u.id === id ? { ...u, readAt } : u)) }))
    } catch (err) {
      toast(err.message, { tone: 'error' })
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Messages from home"
        subtitle="Short messages from your family, passed on by the bailiff after the court has reviewed them."
      />
      <p className="mb-6 flex items-start gap-3 rounded-xl bg-surface-2 px-4 py-3 text-muted">
        <Icon name="shield" className="mt-0.5 shrink-0" />
        While the jury is sequestered you can’t reply from here. If something is urgent, tell the bailiff.
      </p>
      {updates.length ? (
        <ul className="flex flex-col gap-4">
          {updates.map((u) => (
            <li key={u.id}>
              <Card className={cx('p-6', !u.readAt && 'border-accent/50')}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-muted">{fmtDateTime(u.createdAt)}</span>
                  {u.readAt ? <Badge>Read</Badge> : <Badge tone="accent">New</Badge>}
                </div>
                <p className="text-lg leading-relaxed whitespace-pre-wrap">{u.body}</p>
                {!u.readAt && (
                  <Button className="mt-4" size="sm" icon="check" onClick={() => markRead(u.id)}>Mark as read</Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="mail" title="No messages yet">When your family sends a message through the court, it will appear here.</EmptyState>
      )}
    </div>
  )
}
