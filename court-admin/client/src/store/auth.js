import { create } from 'zustand'
import { api, setUnauthorizedHandler } from '../lib/api'

export const useAuth = create((set) => ({
  user: null,
  ready: false,

  async init() {
    setUnauthorizedHandler(() => set({ user: null }))
    try {
      const { user } = await api('/auth/me')
      set({ user, ready: true })
    } catch {
      set({ user: null, ready: true })
    }
  },

  async login(username, password) {
    const { user } = await api('/auth/login', { method: 'POST', body: { username, password } })
    set({ user })
    return user
  },

  async logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    set({ user: null })
  },
}))
