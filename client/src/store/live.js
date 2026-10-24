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
 * Where the room display's timeline is scrolled to (see display:pan on the
 * server). `start` is this device's clock when it was at `pos`, so a glide
 * that's already under way picks up where it is.
 */
const readPan = ({ elapsed = 0, ...p }) => ({ ...p, start: performance.now() - elapsed })

/** How far along (0 to 1) the room display's timeline is right now. */
export const panPos = (pan, now = performance.now()) =>
  pan.playing ? Math.min(1, pan.pos + (now - pan.start) / pan.duration) : pan.pos

/** Whether an auto-scroll is still gliding (it stops by itself at the end). */
export const panPlaying = (pan) => pan.playing && panPos(pan) < 1

const PAN_EVERY_MS = 50
let panTimer = null
let panSentAt = 0

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

const latestFrom = (messages, from, after = '') => messages.reduce((a, m) => (m.from === from && m.at > a ? m.at : a), after)

/**
 * Bailiff: whether a juror's chat has messages the bailiff hasn't read yet.
 * Read means the chat was on screen; replying counts too, as you can't reply
 * without seeing it.
 */
export const chatUnread = (s, c) =>
  latestFrom(c.messages, 'juror') > latestFrom(c.messages, 'bailiff', s.chatReadAt[c.seatId] ?? '')

/** Juror: unseen bailiff messages in the chat. Bailiff: juror chats with unread messages. */
export const unreadChat = (s) =>
  isJuror(s.role) ? unseen(s, 'chat') : s.chats.filter((c) => chatUnread(s, c)).length

const initial = {
  connected: false,
  role: null,
  timeline: [],
  links: [],
  notes: [],
  personal: { highlights: {}, checks: {}, timeline: [], notebook: [] }, // this juror's own highlights, checklist ticks, private timeline and notebook
  burden: '',
  votes: [],
  votedIn: [],
  display: { view: 'timeline', voteId: null, exhibitId: null, message: null },
  pan: readPan({ zoom: 'fit', pos: 0, playing: false, duration: 0 }),
  displayOnline: false, // whether the room display is signed in and connected
  counts: [],
  presence: [],
  exhibits: [],
  exhibitsLoaded: false,
  myRequests: [],
  myChat: null, // this juror's chat with the bailiff: { seatId, seat, messages }
  queue: [],
  chats: [], // bailiff: every juror chat with messages, newest first
  alertAt: 0,
}

export const useLive = create((set, get) => ({
  ...initial,
  soundOn: load('soundOn', true),

  setSound(on) {
    store('soundOn', on)
    set({ soundOn: on })
    if (on) chime()
  },

  // Foreperson: switch the room display to each new poll or ballot as it opens.
  autoProject: load('autoProject', true),
  setAutoProject(autoProject) {
    store('autoProject', autoProject)
    set({ autoProject })
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

  // Bailiff: per juror seat, the newest juror message read. Kept on the device, like the juror's.
  chatReadAt: {},
  markChatRead(seatId) {
    const s = get()
    const c = s.chats.find((x) => x.seatId === seatId)
    const read = s.chatReadAt[seatId] ?? ''
    const latest = c ? latestFrom(c.messages, 'juror', read) : read
    if (latest === read) return
    const chatReadAt = { ...s.chatReadAt, [seatId]: latest }
    store(`chatReadAt:${s.userId}`, chatReadAt)
    set({ chatReadAt })
  },

  connect(user) {
    get().disconnect()
    set({
      ...initial,
      role: user.role,
      userId: user.id,
      bailiffSeenAt: load(`bailiffSeenAt:${user.id}`, null),
      chatSeenAt: load(`chatSeenAt:${user.id}`, null),
      chatReadAt: load(`chatReadAt:${user.id}`, {}),
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
        pan: s.pan ? readPan(s.pan) : initial.pan,
        displayOnline: s.displayOnline ?? false,
        counts: s.counts ?? [],
        presence: s.presence ?? [],
      })
      get().loadExhibits()
      if (isJuror(s.role)) {
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
    socket.on('display:pan', (pan) => set({ pan: readPan(pan) }))
    socket.on('display:presence', ({ online }) => set({ displayOnline: online }))
    socket.on('vote:changed', (vote) => {
      const votes = get().votes
      const i = votes.findIndex((v) => v.id === vote.id)
      set({ votes: i === -1 ? [...votes, vote] : votes.map((v) => (v.id === vote.id ? vote : v)) })
    })
    // Deliberations restarted: every poll and ballot is gone, so nobody has voted in anything.
    socket.on('votes:reset', ({ votes }) => set({ votes, votedIn: [] }))
    socket.on('vote:recorded', ({ id }) => set({ votedIn: [...new Set([...get().votedIn, id])] }))
    socket.on('exhibits:changed', () => get().loadExhibits())
    socket.on('presence', (presence) => set({ presence }))

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
      if (r.type === 'verdict') {
        // Always announced, even with do not disturb on: the court is waiting for this.
        if (get().soundOn) chime()
        toast(`Verdict reached. The foreperson (Juror ${r.seat}) is ready to tell the court.`, { tone: 'warn', timeout: 20000 })
        return
      }
      notify(`New request from Juror ${r.seat}`, { chime: true, tone: 'warn', timeout: 8000 })
    })
    socket.on('request:answered', ({ mode }) => {
      notify(mode === 'written' ? 'The court has answered the jury’s question. Read it on the Requests page.' : 'The judge will answer the jury’s question in the courtroom.')
    })
    socket.on('request:message', (m) => {
      const what = { break: 'break', meal: 'meal order', supplies: 'supplies request', judge_question: 'question for the judge', verdict: 'verdict notice' }[m.type] ?? 'request'
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

  /**
   * Foreperson: scroll the room display's timeline, or start or stop its
   * auto-scroll. Shown here at once; sent at most every PAN_EVERY_MS, always
   * ending with the latest, so a drag doesn't flood the server.
   */
  setPan(change) {
    const now = get().pan
    // Anything left out stays as it is, and a glide stops where it has got to.
    const pan = { zoom: now.zoom, pos: panPos(now), playing: false, duration: 0, ...change }
    set({ pan: readPan(pan) })
    const send = () => {
      panTimer = null
      panSentAt = Date.now()
      socket?.emit('display:pan', pan)
    }
    clearTimeout(panTimer)
    const wait = PAN_EVERY_MS - (Date.now() - panSentAt)
    if (wait <= 0) send()
    else panTimer = setTimeout(send, wait)
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
