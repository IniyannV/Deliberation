import { create } from 'zustand'
import { load, store } from './storage'

/*
 * Read aloud, for jurors who find reading on screen hard. Uses the device's
 * own speech voices (the Web Speech API), so nothing leaves the device; voices
 * that need the internet are skipped, since the jury network has none.
 */

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
export const SPEECH_RATES = [0.75, 1, 1.25, 1.5]

// Long utterances get cut off part way in some browsers, so speak sentence-sized pieces.
function chunks(text) {
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?;:]+[.!?;:]*\s*/g) ?? []
  const out = []
  for (const s of sentences) {
    const last = out.at(-1)
    if (last && last.length + s.length < 220) out[out.length - 1] = last + s
    else for (let i = 0; i < s.length; i += 220) out.push(s.slice(i, i + 220))
  }
  return out.map((c) => c.trim()).filter(Boolean)
}

function voice() {
  const local = synth.getVoices().filter((v) => v.localService)
  const lang = navigator.language?.toLowerCase() ?? 'en-us'
  return (
    local.find((v) => v.lang.toLowerCase() === lang && v.default) ??
    local.find((v) => v.lang.toLowerCase() === lang) ??
    local.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2))) ??
    local[0] ??
    null
  )
}

let run = 0 // bumps on every new speak or stop, so a cancelled run's callbacks do nothing

export const useSpeech = create((set, get) => ({
  supported: !!synth && typeof window.SpeechSynthesisUtterance === 'function',
  // The Read aloud setting: adds the page reader to the title bar and a Speak
  // button over selected text.
  enabled: load('readAloud', false),
  setEnabled(enabled) {
    store('readAloud', enabled)
    set({ enabled })
    if (!enabled) get().stop()
  },
  rate: SPEECH_RATES.includes(load('speechRate', 1)) ? load('speechRate', 1) : 1,
  setRate(rate) {
    store('speechRate', rate)
    set({ rate })
  },
  speaking: false,

  speak(text) {
    if (!get().supported) return
    const parts = chunks(text ?? '')
    synth.cancel()
    const id = ++run
    if (!parts.length) return set({ speaking: false })
    set({ speaking: true })
    const v = voice()
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part)
      if (v) { u.voice = v; u.lang = v.lang }
      u.rate = get().rate
      if (i === parts.length - 1) u.onend = () => id === run && set({ speaking: false })
      u.onerror = () => id === run && set({ speaking: false })
      synth.speak(u)
    })
  },
  stop() {
    run++
    synth?.cancel()
    set({ speaking: false })
  },
}))

// Voices load asynchronously in some browsers; asking early warms the list.
synth?.getVoices()

const SKIP = 'button, svg, script, style, input, select, textarea, [aria-hidden="true"], [data-no-read], .sr-only'
const BLOCK = /^(P|H[1-6]|LI|DIV|SECTION|ARTICLE|HEADER|FOOTER|TD|TH|TR|BLOCKQUOTE|DT|DD|FIGCAPTION|LABEL)$/

/**
 * The text a sighted reader would read in `root`, in order, without button
 * labels or icons. Separate blocks (a heading, a card) become separate
 * sentences so the voice pauses between them.
 */
export function readableText(root) {
  if (!root) return ''
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest(SKIP) || !n.textContent.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  const blockOf = (n) => {
    let el = n.parentElement
    while (el && el !== root && !BLOCK.test(el.tagName)) el = el.parentElement
    return el
  }
  let out = ''
  let prevBlock = null
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.replace(/\s+/g, ' ')
    const block = blockOf(n)
    if (out && block !== prevBlock) out = /[.!?:;]\s*$/.test(out) ? `${out.trimEnd()} ` : `${out.trimEnd()}. `
    out += text
    prevBlock = block
  }
  return out.trim()
}
