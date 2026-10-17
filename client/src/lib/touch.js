import { useMemo, useRef } from 'react'

export const LONG_PRESS_MS = 500
export const LONG_PRESS_SLOP = 10

/*
 * iPad Safari never fires `contextmenu` for a long press, so anything that
 * opens on right-click must also open when a finger or pen is held still.
 * Spread the returned props on the element; `onMenu(x, y, event)` receives
 * client coordinates for both right-clicks and long presses. Moving more
 * than a few points (a scroll or a drag) cancels the press, and the click
 * that follows a long press is swallowed so it doesn't also select.
 */
export function useLongPress(onMenu, { delay = LONG_PRESS_MS } = {}) {
  const latest = useRef(onMenu)
  latest.current = onMenu
  return useMemo(() => {
    let timer = null
    let start = null
    let fired = false
    const cancel = () => { clearTimeout(timer); timer = null }
    return {
      onPointerDown(e) {
        fired = false
        cancel()
        if (e.pointerType === 'mouse' || !e.isPrimary) return
        start = { x: e.clientX, y: e.clientY }
        const target = e.currentTarget
        timer = setTimeout(() => {
          timer = null
          fired = true
          navigator.vibrate?.(10)
          latest.current(start.x, start.y, { currentTarget: target })
        }, delay)
      },
      onPointerMove(e) {
        if (timer && Math.hypot(e.clientX - start.x, e.clientY - start.y) > LONG_PRESS_SLOP) cancel()
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onClickCapture(e) {
        if (!fired) return
        fired = false
        e.preventDefault()
        e.stopPropagation()
      },
      onContextMenu(e) {
        e.preventDefault()
        // Some touch browsers also send contextmenu for the same press.
        if (fired) return
        latest.current(e.clientX, e.clientY, e)
      },
    }
  }, [delay])
}
