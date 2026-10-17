import { createContext, useContext, useEffect } from 'react'

/*
 * Lets a page's large title hand off to the compact title in the shell's
 * translucent title bar once it scrolls underneath, as in iOS and macOS.
 */
export const TitleBarContext = createContext(null)

export function useCompactTitle(title, ref) {
  const setCompact = useContext(TitleBarContext)
  useEffect(() => {
    const el = ref.current
    if (!setCompact || !el) return
    const io = new IntersectionObserver(
      ([entry]) => setCompact({ title, visible: !entry.isIntersecting && entry.boundingClientRect.top < 80 }),
      { rootMargin: '-56px 0px 0px 0px', threshold: 0 },
    )
    io.observe(el)
    return () => { io.disconnect(); setCompact(null) }
  }, [title, ref, setCompact])
}
