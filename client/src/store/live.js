import { create } from 'zustand'
import { io } from 'socket.io-client'
import { api } from '../lib/api'
import { chime } from '../lib/sound'
import { load, store } from '../lib/storage'
import { toast, useUi } from './ui'

/*
 * Everything that updates in real time lives here. The socket connects to
 * the same origin that served the page (the court laptop) and nothing else.
 */

let socket = null

const isJuror = (role) => role === 'juror' || role === 'foreperson'

/*
 * What the bailiff has said to this juror, apart by where it's read: replies
 * on request threads (read on the Requests page) and the open chat (read in
 * the chat window). Each has its own "seen up to" server timestamp.
 */
const SEEN = {
  requests: { key: 'bailiffSeenAt', messages: (s) => s.myRequests.flatMap((r) => r.messages ?? []) },
  chat: { key: 'chatSeenAt', messages: (s) => s.myChat?.messages ?? [] },
}
const unseen = (s, kind) => SEEN[kind].messages(s).filter((m) => m.from === 'bailiff' && m.at > (s[SEEN[kind].key] ?? '')).length

/** Bailiff replies on request threads since the juror last had the Requests page open. */
export const unreadRequestReplies = (s) => unseen(s, 'requests')

/** Juror: unseen bailiff messages in the chat. Bailiff: chats waiting on a reply. */
export const unreadChat = (s) =>
  isJuror(s.role) ? unseen(s, 'chat') : s.chats.filter((c) => c.messages.at(-1)?.from === 'juror').length

const initial = {
  connected: false,
  role: null,
  timeline: [],
  links: [],
  notes: [],
  personal: { highlights: {}, checks: {}, timeline: [] }, // this juror's own highlights, checklist ticks and private timeline
  burden: '',
  votes: [],
  votedIn: [],
  display: { view: 'timeline', voteId: null, exhibitId: null },
  counts: [],
  presence: [],
  exhibits: [],
  exhibitsLoaded: false,
  updates: [],
  myRequests: [],
  myChat: null, // this juror's chat with the bailiff: { seatId, seat, messages }
  queue: [],
  chats: [], // bailiff: every juror chat with messages, newest first
  alertAt: 0,
  updatesVersion: 0,
}

export const useLive = create((set, get) => ({
  ...initial,
  soundOn: load('soundOn', true),

  setSound(on) {
    store('soundOn', on)
    set({ soundOn: on })
    if (on) chime()
  },

  // Do not disturb: no pop-ups or chimes for incoming messages and requests.
  // Counts and badges still update.
  dnd: load('dnd', false),
  setDnd(dnd) {
    store('dnd', dnd)
    set({ dnd })
  },

  // Server timestamps of the newest bailiff messages this juror has seen. Kept
  // on the device per seat; the server doesn't track reads for messages.
  bailiffSeenAt: null,
  chatSeenAt: null,
  /** `kind` is 'requests' or 'chat'. */
  markSeen(kind) {
    const s = get()
    const { key, messages } = SEEN[kind]
    const seen = s[key] ?? ''
    const latest = messages(s).filter((m) => m.from === 'bailiff').reduce((a, m) => (m.at > a ? m.at : a), seen)
    if (latest === seen) return
    store(`${key}:${s.userId}`, latest)
    set({ [key]: latest })
  },

  connect(user) {
    get().disconnect()
    set({
      ...initial,
      role: user.role,
      userId: user.id,
      bailiffSeenAt: load(`bailiffSeenAt:${user.id}`, null),
      chatSeenAt: load(`chatSeenAt:${user.id}`, null),
    })
    socket = io({ withCredentials: true })

    // A pop-up (and for the bailiff, a chime) for something that just arrived,
    // unless do not disturb is on.
    const notify = (message, { chime: ring = false, ...opts } = {}) => {
      if (get().dnd) return
      if (ring && get().soundOn) chime()
      toast(message, opts)
    }
    // No need to announce a chat message that's already on screen in the chat window.
    const chatShowing = (seatId) => {
      const ui = useUi.getState()
      return ui.chatOpen && (seatId == null || ui.chatSeat === seatId)
    }

    socket.on('connect', () => set({ connected: true }))
    socket.on('disconnect', async (reason) => {
      set({ connected: false })
      // The server cut us off on purpose (logout, PIN reset, role change): re-check who we are.
      if (reason === 'io server disconnect') {
        const { useAuth } = await import('./auth')
        useAuth.getState().refresh()
      }
    })
    socket.on('connect_error', async (err) => {
      if (err.message === 'unauthorized') {
        const { useAuth } = await import('./auth')
        useAuth.getState().expire()
      }
    })

    socket.on('state:sync', (s) => {
      set({
        role: s.role,
        timeline: s.timeline ?? [],
        links: s.links ?? [],
        notes: s.notes ?? [],
        personal: s.personal ?? initial.personal,
        burden: s.burden ?? '',
        votes: s.votes ?? [],
        votedIn: s.votedIn ?? [],
        display: s.display ?? initial.display,
        counts: s.counts ?? [],
        presence: s.presence ?? [],
      })
      get().loadExhibits()
      if (isJuror(s.role)) {
        get().loadUpdates()
        get().loadMyRequests()
        get().loadMyChat()
      }
      if (s.role === 'bailiff') {
        get().loadQueue()
        get().loadChats()
      }
    })

    socket.on('timeline:changed', (timeline) => set({ timeline }))
    socket.on('links:changed', (links) => set({ links }))
    socket.on('notes:changed', (notes) => set({ notes }))
    socket.on('personal:changed', (personal) => set({ personal }))
    socket.on('display:changed', (display) => set({ display }))
    socket.on('vote:changed', (vote) => {
      const votes = get().votes
      const i = votes.findIndex((v) => v.id === vote.id)
      set({ votes: i === -1 ? [...votes, vote] : votes.map((v) => (v.id === vote.id ? vote : v)) })
    })
    socket.on('vote:recorded', ({ id }) => set({ votedIn: [...new Set([...get().votedIn, id])] }))
    socket.on('exhibits:changed', () => get().loadExhibits())
    socket.on('presence', (presence) => set({ presence }))

    socket.on('update:new', (u) => {
      set({ updates: [u, ...get().updates] })
      notify('A new message from home has arrived on your bulletin board.')
    })
    socket.on('request:updated', (r) => {
      if (isJuror(get().role)) {
        const mine = get().myRequests
        const known = mine.some((x) => x.id === r.id)
        set({ myRequests: known ? mine.map((x) => (x.id === r.id ? r : x)) : [r, ...mine] })
      } else {
        set({ queue: get().queue.map((x) => (x.id === r.id ? r : x)) })
      }
    })
    socket.on('request:new', (r) => {
      set({ queue: [r, ...get().queue.filter((x) => x.id !== r.id)], alertAt: Date.now() })
      notify(`New request from Juror ${r.seat}`, { chime: true, tone: 'warn', timeout: 8000 })
    })
    socket.on('request:message', (m) => {
      const what = { break: 'break', meal: 'meal order', supplies: 'supplies request', judge_question: 'question for the judge' }[m.type] ?? 'request'
      if (m.from === 'bailiff') notify(`The bailiff sent you a message about your ${what}.`)
      else notify(`Juror ${m.seat} sent a message about their ${what}.`, { chime: true, tone: 'warn', timeout: 8000 })
    })
    socket.on('chat:updated', (c) => {
      const last = c.messages.at(-1)
      if (isJuror(get().role)) {
        set({ myChat: c })
        if (last?.from === 'bailiff' && !chatShowing()) notify('The bailiff sent you a message.')
      } else {
        set({ chats: [c, ...get().chats.filter((x) => x.seatId !== c.seatId)] })
        if (last?.from === 'juror' && !chatShowing(c.seatId)) {
          notify(`Juror ${c.seat} sent you a message.`, { chime: true, tone: 'warn', timeout: 8000 })
        }
      }
    })
    socket.on('updates:changed', () => set({ updatesVersion: get().updatesVersion + 1 }))
  },

  reconnect() {
    if (socket && !socket.connected) socket.connect()
  },

  disconnect() {
    socket?.removeAllListeners()
    socket?.disconnect()
    socket = null
    set({ connected: false })
  },

  /** Emit a socket event and wait for the server's acknowledgement. */
  emit(event, payload) {
    return new Promise((resolve, reject) => {
      if (!socket?.connected) return reject(new Error('Not connected to the court server. Retrying…'))
      socket.timeout(8000).emit(event, payload, (err, res) => {
        if (err) return reject(new Error('The court server did not respond. Please try again.'))
        if (res?.error) return reject(new Error(res.error))
        resolve(res)
      })
    })
  },

  async loadExhibits() {
    try {
      const { exhibits } = await api('/exhibits')
      set({ exhibits, exhibitsLoaded: true })
    } catch {
      /* role may not allow it */
    }
  },
  async loadUpdates() {
    const { updates } = await api('/updates')
    set({ updates })
  },
  async loadMyRequests() {
    const { requests } = await api('/requests')
    set({ myRequests: requests })
  },
  async loadMyChat() {
    const { chat } = await api('/chat')
    set({ myChat: chat })
  },
  async loadChats() {
    const { chats } = await api('/admin/chats')
    set({ chats })
  },
  async loadQueue() {
    const { requests } = await api('/admin/requests')
    set({ queue: requests })
  },
}))
