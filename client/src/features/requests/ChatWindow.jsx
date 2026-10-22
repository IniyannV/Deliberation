import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { load, store } from '../../lib/storage'
import { useAuth } from '../../store/auth'
import { chatUnread, unreadChat, useLive } from '../../store/live'
import { useUi } from '../../store/ui'
import { IconButton, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import { MessageThread } from './RequestThread'

const MIN_W = 300
const MIN_H = 320
const MARGIN = 8

const defaultRect = () => {
  const w = Math.min(380, window.innerWidth - MARGIN * 2)
  const h = Math.min(520, window.innerHeight - MARGIN * 2)
  return { w, h, x: window.innerWidth - w - 24, y: window.innerHeight - h - 24 }
}

/** Keep the whole window on screen, shrinking it if the screen is smaller. */
function clampRect(r) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(Math.max(r.w, MIN_W), vw - MARGIN * 2)
  const h = Math.min(Math.max(r.h, MIN_H), vh - MARGIN * 2)
  return {
    w,
    h,
    x: Math.min(Math.max(r.x, MARGIN), vw - w - MARGIN),
    y: Math.min(Math.max(r.y, MARGIN), vh - h - MARGIN),
  }
}

/** Resize from any edge or corner: the opposite edges stay put. */
function resized(r0, dir, dx, dy) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let { x, y, w, h } = r0
  if (dir.includes('e')) w = Math.min(Math.max(r0.w + dx, MIN_W), vw - MARGIN - r0.x)
  if (dir.includes('s')) h = Math.min(Math.max(r0.h + dy, MIN_H), vh - MARGIN - r0.y)
  if (dir.includes('w')) {
    const right = r0.x + r0.w
    x = Math.max(MARGIN, Math.min(r0.x + dx, right - MIN_W))
    w = right - x
  }
  if (dir.includes('n')) {
    const bottom = r0.y + r0.h
    y = Math.max(MARGIN, Math.min(r0.y + dy, bottom - MIN_H))
    h = bottom - y
  }
  return { x, y, w, h }
}

/** Follow one pointer from press to release, reporting how far it has moved. */
function track(e, onMove, onEnd) {
  if (e.button !== 0) return
  e.preventDefault()
  const el = e.currentTarget
  const x0 = e.clientX
  const y0 = e.clientY
  el.setPointerCapture?.(e.pointerId)
  const move = (ev) => onMove(ev.clientX - x0, ev.clientY - y0)
  const end = () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', end)
    el.removeEventListener('pointercancel', end)
    onEnd()
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', end)
  el.addEventListener('pointercancel', end)
}

const EDGES = {
  n: 'inset-x-4 top-0 h-2 cursor-ns-resize',
  s: 'inset-x-4 bottom-0 h-2 cursor-ns-resize',
  e: 'inset-y-4 right-0 w-2 cursor-ew-resize',
  w: 'inset-y-4 left-0 w-2 cursor-ew-resize',
  nw: 'top-0 left-0 h-4 w-4 cursor-nwse-resize',
  ne: 'top-0 right-0 h-4 w-4 cursor-nesw-resize',
  sw: 'bottom-0 left-0 h-4 w-4 cursor-nesw-resize',
  se: 'right-0 bottom-0 h-5 w-5 cursor-nwse-resize',
}

/**
 * A floating chat window over every page, so a juror can keep talking to the
 * bailiff (or the bailiff to a juror) while moving around the app. Drag it by
 * its title bar, resize it from any edge; it remembers where it was left.
 */
export default function ChatWindow() {
  const { chatOpen, chatSeat, closeChat, openChat } = useUi()
  const role = useAuth((s) => s.user?.role)
  const bailiff = role === 'bailiff'
  const myChat = useLive((s) => s.myChat)
  const chats = useLive((s) => s.chats)
  const chatReadAt = useLive((s) => s.chatReadAt)
  const unread = useLive(unreadChat)

  const [rect, setRect] = useState(() => clampRect(load('chatRect', null) ?? defaultRect()))
  const latest = useRef(rect)
  latest.current = rect
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    const fit = () => setRect((r) => clampRect(r))
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // The bailiff's window shows one juror's chat; pin it so a message from
  // another juror doesn't switch the conversation mid-reply.
  const shown = bailiff ? chats.find((c) => c.seatId === chatSeat) ?? chats[0] : myChat
  useEffect(() => {
    if (chatOpen && bailiff && shown && shown.seatId !== chatSeat) openChat(shown.seatId)
  }, [chatOpen, bailiff, shown, chatSeat, openChat])

  // An open window counts as reading the chat it shows, including messages that arrive while it's open.
  useEffect(() => {
    if (chatOpen && !bailiff && unread) useLive.getState().markSeen('chat')
  }, [chatOpen, bailiff, unread])
  useEffect(() => {
    if (chatOpen && bailiff && shown) useLive.getState().markChatRead(shown.seatId)
  }, [chatOpen, bailiff, shown])

  if (!chatOpen) return null

  const gesture = (e, next) => {
    const r0 = latest.current
    setMoving(true)
    track(
      e,
      (dx, dy) => setRect(next(r0, dx, dy)),
      () => {
        setMoving(false)
        store('chatRect', latest.current)
      },
    )
  }
  const drag = (e) => {
    if (e.target.closest('button')) return
    gesture(e, (r0, dx, dy) => clampRect({ ...r0, x: r0.x + dx, y: r0.y + dy }))
  }

  async function send(text) {
    if (bailiff) {
      const { chat } = await api(`/admin/chats/${shown.seatId}/messages`, { method: 'POST', body: { text } })
      useLive.setState((s) => ({ chats: s.chats.map((c) => (c.seatId === chat.seatId ? chat : c)) }))
    } else {
      const { chat } = await api('/chat', { method: 'POST', body: { text } })
      useLive.setState({ myChat: chat })
    }
  }

  return (
    <section
      role="dialog"
      aria-labelledby="chat-window-title"
      onKeyDown={(e) => e.key === 'Escape' && closeChat()}
      className={cx('materialize fixed z-[45] flex flex-col overflow-hidden rounded-[1.375rem] border border-line/40 bg-elevated shadow-[var(--shadow-float)]', moving && 'select-none')}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      <header
        onPointerDown={drag}
        className={cx('flex shrink-0 touch-none items-center gap-3 border-b border-line/60 py-2.5 pr-2 pl-4 select-none', moving ? 'cursor-grabbing' : 'cursor-grab')}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-b from-[#3b8cff] to-[#0062d6] text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.4)]">
          <Icon name={bailiff ? 'users' : 'shield'} size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="chat-window-title" className="truncate leading-tight font-bold">
            {bailiff ? (shown ? `Juror ${shown.seat}` : 'Juror chats') : 'Chat with the bailiff'}
          </h2>
          <p className="truncate text-sm text-muted">{bailiff ? 'Not recorded in the audit log' : 'For anything that isn’t a request'}</p>
        </div>
        <IconButton icon="x" label="Close chat" onClick={closeChat} />
      </header>

      {bailiff && chats.length > 1 && (
        <div role="tablist" aria-label="Juror chats" className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-line/60 px-3 py-2 [scrollbar-width:none]">
          {chats.map((c) => {
            const active = c.seatId === shown?.seatId
            const waiting = chatUnread({ chatReadAt }, c)
            return (
              <button
                key={c.seatId}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => openChat(c.seatId)}
                className={cx('pressable pressable-soft relative shrink-0 rounded-full px-3 py-1 text-sm font-semibold', active ? 'bg-accent text-accent-ink' : 'bg-fill text-ink')}
              >
                Juror {c.seat}
                {waiting && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-alert ring-2 ring-surface"><span className="sr-only">, unread messages</span></span>}
              </button>
            )
          })}
        </div>
      )}

      {bailiff && !shown ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-muted">
          <Icon name="chat" size={28} className="mb-2 text-accent" />
          <p className="font-semibold text-ink">No juror chats yet</p>
          <p className="mt-1 text-sm">When a juror messages you, the conversation appears here.</p>
        </div>
      ) : (
        <MessageThread
          key={shown?.seatId ?? 'mine'}
          id="chat-window"
          panel
          messages={shown?.messages ?? []}
          viewer={bailiff ? 'bailiff' : 'juror'}
          seat={shown?.seat}
          onSend={send}
          className="min-h-0 flex-1"
          empty={
            <>
              <Icon name="chat" size={28} className="mb-2 text-accent" />
              <p className="font-semibold text-ink">No messages yet</p>
              <p className="mt-1 max-w-60 text-sm">Ask about anything that isn’t a request. Don’t discuss the case or how the jury is leaning.</p>
            </>
          }
        />
      )}

      {Object.entries(EDGES).map(([dir, cls]) => (
        <span key={dir} aria-hidden onPointerDown={(e) => gesture(e, (r0, dx, dy) => resized(r0, dir, dx, dy))} className={cx('absolute z-10 touch-none', cls)} />
      ))}
      {/* A visible grip in the corner people reach for first. */}
      <svg aria-hidden viewBox="0 0 10 10" className="pointer-events-none absolute right-1.5 bottom-1.5 h-2.5 w-2.5 text-muted/70">
        <path d="M9 3L3 9M9 6.5L6.5 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </section>
  )
}
