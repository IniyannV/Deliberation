import { useEffect, useRef } from 'react'
import { Badge, Button, cx } from '../../components/ui'
import TextSize from '../../components/TextSize'

const fsElement = () => document.fullscreenElement ?? document.webkitFullscreenElement

/**
 * Wraps an exhibit so it can grow to fill the whole screen. The same element
 * is restyled rather than remounted, so a playing video keeps playing and a
 * PDF keeps its zoom. Where the browser allows it (iPadOS does) it also
 * enters true full screen, hiding the browser's own bars.
 */
export default function Enlargeable({ exhibit, enlarged, onExit, className, children }) {
  const ref = useRef(null)
  const exit = useRef(onExit)
  exit.current = onExit

  useEffect(() => {
    if (!enlarged) return
    const el = ref.current
    let entered = false
    try {
      const req = el.requestFullscreen ?? el.webkitRequestFullscreen
      req?.call(el)?.catch?.(() => {})
    } catch {
      // The overlay alone still covers the app.
    }
    const change = () => {
      if (fsElement()) entered = true
      else if (entered) exit.current()
    }
    const key = (e) => { if (e.key === 'Escape') exit.current() }
    document.addEventListener('fullscreenchange', change)
    document.addEventListener('webkitfullscreenchange', change)
    window.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('fullscreenchange', change)
      document.removeEventListener('webkitfullscreenchange', change)
      window.removeEventListener('keydown', key)
      if (fsElement()) (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document)?.catch?.(() => {})
    }
  }, [enlarged])

  return (
    <div
      ref={ref}
      role={enlarged ? 'dialog' : undefined}
      aria-label={enlarged ? `${exhibit.number}: ${exhibit.title}, full screen` : undefined}
      className={enlarged ? 'fixed inset-0 z-[60] flex flex-col bg-surface' : cx('flex flex-col', className)}
    >
      {enlarged && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
          <div className="flex min-w-0 items-center gap-3">
            <Badge tone="accent" className="text-base">{exhibit.number}</Badge>
            <h2 className="truncate text-lg font-bold">{exhibit.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <TextSize />
            <Button size="sm" icon="minimize" onClick={onExit}>Exit full screen</Button>
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
