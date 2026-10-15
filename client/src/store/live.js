import { create } from 'zustand'
import { io } from 'socket.io-client'
import { api } from '../lib/api'
import { chime } from '../lib/sound'
import { load, store } from '../lib/storage'
import { toast } from './ui'

/*
 * Everything that updates in real time lives here. The socket connects to
 * the same origin that served the page (the court laptop) and nothing else.
 */

let socket = null

const isJuror = (role) => role === 'juror' || role === 'foreperson'

const initial = {
  connected: false,
  role: null,
  timeline: [],
  links: [],
  notes: [],
  burden: '',
  votes: [],
  votedIn: [],
  display: { view: 'timeline', voteId: null },
  counts: [],
  presence: [],
  exhibits: [],
  exhibitsLoaded: false,
  updates: [],
  myRequests: [],
  queue: [],
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

  connect(user) {
    get().disconnect()
    set({ ...initial, role: user.role })
    socket = io({ withCredentials: true })

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
      }
      if (s.role === 'bailiff') get().loadQueue()
    })

    socket.on('timeline:changed', (timeline) => set({ timeline }))
    socket.on('links:changed', (links) => set({ links }))
    socket.on('notes:changed', (notes) => set({ notes }))
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
      toast('A new message from home has arrived on your bulletin board.')
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
      if (get().soundOn) chime()
      toast(`New request from Juror ${r.seat}`, { tone: 'warn', timeout: 8000 })
    })
    socket.on('request:message', (m) => {
      const what = { break: 'break', meal: 'meal order', supplies: 'supplies request', judge_question: 'question for the judge' }[m.type] ?? 'request'
      if (m.from === 'bailiff') toast(`The bailiff sent you a message about your ${what}.`)
      else {
        if (get().soundOn) chime()
        toast(`Juror ${m.seat} sent a message about their ${what}.`, { tone: 'warn', timeout: 8000 })
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
  async loadQueue() {
    const { requests } = await api('/admin/requests')
    set({ queue: requests })
  },
}))
