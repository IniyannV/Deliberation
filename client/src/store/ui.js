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

/*
 * Text size. Everything is sized in rem, so scaling the root font size
 * scales the whole interface like browser zoom, which iPad Safari has no
 * keyboard shortcut for. 106.25% is the 17px iOS body size from index.css.
 */
export const TEXT_SCALES = [0.85, 1, 1.15, 1.3, 1.5, 1.75]
const applyTextScale = (scale) => {
  document.documentElement.style.fontSize = scale === 1 ? '' : `${106.25 * scale}%`
}
const initialTextScale = TEXT_SCALES.includes(load('textScale', 1)) ? load('textScale', 1) : 1
applyTextScale(initialTextScale)

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

  textScale: initialTextScale,
  stepTextScale(dir) {
    const i = TEXT_SCALES.indexOf(get().textScale)
    const textScale = TEXT_SCALES[Math.min(TEXT_SCALES.length - 1, Math.max(0, i + dir))]
    applyTextScale(textScale)
    store('textScale', textScale)
    set({ textScale })
  },

  // The sidebar starts tucked away on wide screens to give pages the room, and
  // AppShell tucks it away again after each navigation. Not persisted, so every
  // sign-in starts with it closed.
  sidebarCollapsed: true,
  setSidebarCollapsed(sidebarCollapsed) {
    set({ sidebarCollapsed })
  },

  // The floating chat window, which stays open from page to page. For the
  // bailiff, `chatSeat` is the juror seat it shows (null: the latest chat).
  chatOpen: false,
  chatSeat: null,
  openChat(chatSeat = null) {
    set({ chatOpen: true, chatSeat })
  },
  closeChat() {
    set({ chatOpen: false })
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
