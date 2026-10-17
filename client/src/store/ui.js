import { create } from 'zustand'
import { load, store } from '../lib/storage'

const applyTheme = (theme) => document.documentElement.classList.toggle('dark', theme === 'dark')

const prefersDark = () => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

const initialTheme = load('theme', prefersDark() ? 'dark' : 'light')
applyTheme(initialTheme)

let toastId = 0
let themeTimer

export const useUi = create((set, get) => ({
  theme: initialTheme,
  toggleTheme() {
    const theme = get().theme === 'dark' ? 'light' : 'dark'
    // Ease the switch so the whole screen doesn't flash to a new brightness.
    const root = document.documentElement
    root.classList.add('theme-transition')
    clearTimeout(themeTimer)
    themeTimer = setTimeout(() => root.classList.remove('theme-transition'), 400)
    applyTheme(theme)
    store('theme', theme)
    set({ theme })
  },

  toasts: [],
  toast(message, { tone = 'info', timeout = 5000 } = {}) {
    const id = ++toastId
    set({ toasts: [...get().toasts, { id, message, tone }] })
    if (timeout) setTimeout(() => get().dismiss(id), timeout)
  },
  // Mark the toast as leaving so it can animate out, then remove it.
  dismiss(id) {
    const t = get().toasts.find((x) => x.id === id)
    if (!t || t.leaving) return
    set({ toasts: get().toasts.map((x) => (x.id === id ? { ...x, leaving: true } : x)) })
    setTimeout(() => set({ toasts: get().toasts.filter((x) => x.id !== id) }), 200)
  },
}))

export const toast = (...args) => useUi.getState().toast(...args)
