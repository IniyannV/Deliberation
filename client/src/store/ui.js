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

export const useUi = create((set, get) => ({
  theme: initialTheme,
  toggleTheme() {
    const theme = get().theme === 'dark' ? 'light' : 'dark'
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
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  },
}))

export const toast = (...args) => useUi.getState().toast(...args)
