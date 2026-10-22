import { useEffect, useState } from 'react'
import { Icon } from './icons'
import { IconButton, Switch, cx } from './ui'
import { SPEECH_RATES, readableText, useSpeech } from '../lib/speech'

/** The sidebar setting: Read aloud on or off, and how fast. */
export function ReadAloudSetting({ className }) {
  const { supported, enabled, setEnabled, rate, setRate } = useSpeech()
  if (!supported) return null
  const next = SPEECH_RATES[(SPEECH_RATES.indexOf(rate) + 1) % SPEECH_RATES.length]
  return (
    <div className={cx('flex items-center justify-between gap-2', className)} data-tour="read-aloud">
      <span id="read-aloud-label" className="flex items-center gap-1.5 text-sm font-medium text-muted">
        <Icon name="volume" size={16} /> Read aloud
      </span>
      <span className="flex items-center gap-1.5">
        {enabled && (
          <button
            type="button"
            onClick={() => setRate(next)}
            aria-label={`Reading speed ${rate} times. Change to ${next} times`}
            title="Reading speed"
            className="pressable min-w-11 rounded-full bg-fill px-2 py-0.5 text-sm font-semibold text-accent tabular-nums"
          >
            {rate}×
          </button>
        )}
        <Switch checked={enabled} onChange={setEnabled} labelledBy="read-aloud-label" />
      </span>
    </div>
  )
}

/** Title bar button: read the page's text aloud, or stop. Shown while Read aloud is on. */
export function ReadPageButton({ target, className }) {
  const { supported, enabled, speaking, speak, stop } = useSpeech()
  if (!supported || !enabled) return null
  return (
    <IconButton
      icon={speaking ? 'stop' : 'volume'}
      label={speaking ? 'Stop reading' : 'Read this page aloud'}
      aria-pressed={speaking}
      className={cx('shadow-card', speaking ? 'bg-accent text-accent-ink hover:bg-accent hover:text-accent-ink' : 'material-bar text-accent', className)}
      onClick={() => (speaking ? stop() : speak(readableText(target.current)))}
    />
  )
}

/**
 * While Read aloud is on, selecting text anywhere (a transcript line, a
 * document, a message) shows a Speak button just below it.
 */
export function SelectionSpeaker() {
  const { supported, enabled, speaking, speak, stop } = useSpeech()
  const [picked, setPicked] = useState(null) // { text, x, y }

  useEffect(() => {
    if (!supported || !enabled) return setPicked(null)
    let t
    const update = () => {
      clearTimeout(t)
      // Wait for the selection to settle, as a drag or long-press extends it.
      t = setTimeout(() => {
        const sel = document.getSelection()
        const text = sel?.toString().trim()
        if (!text || !sel.rangeCount) return setPicked(null)
        const r = sel.getRangeAt(0).getBoundingClientRect()
        if (!r.width && !r.height) return setPicked(null)
        const x = Math.min(Math.max(r.left + r.width / 2, 60), window.innerWidth - 60)
        // Below the selection, clear of the iPad's own copy menu above it; above if there's no room.
        const y = r.bottom + 56 < window.innerHeight ? r.bottom + 12 : Math.max(8, r.top - 52)
        setPicked({ text, x, y })
      }, 250)
    }
    document.addEventListener('selectionchange', update)
    return () => {
      clearTimeout(t)
      document.removeEventListener('selectionchange', update)
    }
  }, [supported, enabled])

  if (!picked) return null
  return (
    <button
      type="button"
      // Pressing it mustn't clear the selection it's about to read.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => (speaking ? stop() : speak(picked.text))}
      className="materialize material pressable fixed z-[60] flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-accent shadow-[var(--shadow-float)]"
      style={{ left: picked.x, top: picked.y }}
    >
      <Icon name={speaking ? 'stop' : 'volume'} size={16} strokeWidth={2.2} />
      {speaking ? 'Stop' : 'Speak'}
    </button>
  )
}
