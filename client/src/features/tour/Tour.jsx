import { useEffect, useLayoutEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { create } from 'zustand'
import { load, store } from '../../lib/storage'
import { Button, IconButton } from '../../components/ui'
import { stepsFor } from './steps'

/*
 * Optional guided tour. A spotlight highlights one part of the page and a
 * card explains it. The page stays interactive underneath, so a visitor can
 * try each feature while the tour runs.
 */

export const useTour = create((set, get) => ({
  active: false,
  index: 0,
  steps: [],
  start(role) {
    const steps = stepsFor(role)
    if (steps.length) set({ active: true, index: 0, steps })
    store('tourOffered', true)
  },
  go(delta) {
    const { index, steps } = get()
    const next = index + delta
    if (next >= steps.length) return get().end()
    set({ index: Math.max(0, next) })
  },
  end() {
    set({ active: false })
  },
}))

export const tourOffered = () => load('tourOffered', false)

const PAD = 8
const CARD_W = 380

function useTargetRect(target, stepKey) {
  const [rect, setRect] = useState(null)
  const [missing, setMissing] = useState(false)

  useLayoutEffect(() => {
    setRect(null)
    setMissing(false)
    if (!target) return setMissing(true)
    let el = null
    let tries = 0
    let scrolled = false
    // Clip to the viewport so a tall target (a long list) still gets a sensible spotlight.
    const measure = () => {
      if (!el) return
      const r = el.getBoundingClientRect()
      const top = Math.max(r.top, PAD * 2)
      const bottom = Math.min(r.bottom, window.innerHeight - PAD * 2)
      setRect({ top, left: r.left, width: r.width, height: Math.max(40, bottom - top) })
    }
    // The target may appear only after navigation and lazy loading.
    const find = setInterval(() => {
      el = document.querySelector(`[data-tour="${target}"]`)
      if (el) {
        clearInterval(find)
        if (!scrolled) {
          el.scrollIntoView({ block: el.getBoundingClientRect().height > window.innerHeight * 0.6 ? 'start' : 'center', inline: 'nearest' })
          scrolled = true
        }
        requestAnimationFrame(measure)
      } else if (++tries > 30) {
        clearInterval(find)
        setMissing(true)
      }
    }, 100)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearInterval(find)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [target, stepKey])

  return { rect, missing }
}

export default function Tour() {
  const { active, index, steps, go, end } = useTour()
  const step = steps[index]
  const location = useLocation()
  const navigate = useNavigate()
  const { rect, missing } = useTargetRect(active ? step?.target : null, `${active}-${index}`)

  useEffect(() => {
    if (active && step?.route && location.pathname !== step.route) navigate(step.route)
  }, [active, step, location.pathname, navigate])

  useEffect(() => {
    if (!active) return
    const key = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
      if (e.key === 'Escape') end()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [active, go, end])

  if (!active || !step) return null

  // Place the card beside the highlighted element, or centred if there isn't one.
  let cardStyle = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  if (rect) {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const left = Math.min(vw - CARD_W - 16, Math.max(16, rect.left))
    if (rect.height > vh - 300) cardStyle = { right: 24, bottom: 24 }
    else if (rect.top + rect.height + 240 < vh) cardStyle = { left, top: rect.top + rect.height + PAD + 12 }
    else if (rect.top > 260) cardStyle = { left, top: rect.top - PAD - 12, transform: 'translateY(-100%)' }
    else if (rect.left + rect.width + CARD_W + 32 < vw) cardStyle = { left: rect.left + rect.width + PAD + 16, top: Math.max(16, Math.min(vh - 280, rect.top)) }
    else cardStyle = { left: Math.max(16, rect.left - CARD_W - PAD - 16), top: Math.max(16, Math.min(vh - 280, rect.top)) }
  }
  const waiting = !rect && !missing

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-live="polite">
      {rect ? (
        <div
          className="motion-travel absolute rounded-2xl ring-2 ring-accent transition-[top,left,width,height] duration-[var(--duration-ui)] ease-[var(--ease-fluid)]"
          style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.45)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/45" />
      )}
      {!waiting && (
        <div key={index} role="dialog" aria-label={`Tour step ${index + 1} of ${steps.length}: ${step.title}`} className="material materialize pointer-events-auto absolute rounded-3xl p-5 text-ink" style={{ ...cardStyle, width: CARD_W }}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-semibold text-accent">Step {index + 1} of {steps.length}</span>
            <IconButton icon="x" label="End tour" size={16} onClick={end} className="-m-1" />
          </div>
          <h2 className="mb-2 text-xl font-bold">{step.title}</h2>
          <p className="text-muted">{step.body}</p>
          <div className="mt-5 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={end}>End tour</Button>
            <div className="flex gap-2">
              <Button size="sm" disabled={index === 0} onClick={() => go(-1)}>Back</Button>
              <Button size="sm" variant="primary" onClick={() => go(1)} autoFocus>{index === steps.length - 1 ? 'Finish' : 'Next'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
