import { create } from 'zustand'
import { api, setUnauthorizedHandler } from '../lib/api'
import { useLive } from './live'

export const homeFor = (role) =>
  role === 'bailiff' ? '/admin' : role === 'display' ? '/display' : role ? '/juror' : '/login'

export const useAuth = create((set, get) => ({
  user: null,
  caseInfo: null,
  status: 'loading', // 'loading' | 'ready'

  async init() {
    try {
      const { user, case: caseInfo } = await api('/auth/me')
      set({ user, caseInfo: caseInfo ?? null, status: 'ready' })
      if (user) useLive.getState().connect(user)
    } catch {
      set({ user: null, status: 'ready' })
    }
  },

  async login(identifier, pin) {
    const { user, case: caseInfo } = await api('/auth/login', { method: 'POST', body: { identifier, pin } })
    set({ user, caseInfo })
    useLive.getState().connect(user)
    return user
  },

  async logout() {
    useLive.getState().disconnect()
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    set({ user: null })
  },

  /** Called when the server drops our session (logout elsewhere, PIN reset, role change). */
  async refresh() {
    try {
      const { user, case: caseInfo } = await api('/auth/me')
      const prev = get().user
      set({ user, caseInfo: caseInfo ?? get().caseInfo })
      if (!user) useLive.getState().disconnect()
      else if (prev?.role !== user.role) useLive.getState().connect(user)
      else useLive.getState().reconnect()
    } catch {
      // Server unreachable; socket.io keeps retrying.
    }
  },

  expire() {
    useLive.getState().disconnect()
    set({ user: null })
  },
}))

setUnauthorizedHandler(() => useAuth.getState().expire())
