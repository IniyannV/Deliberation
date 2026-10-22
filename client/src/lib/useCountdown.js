import { useEffect, useState } from 'react'

/** Time left until `endsAt`, as m:ss (or h:mm:ss). */
export function useCountdown(endsAt) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!endsAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [endsAt])
  if (!endsAt) return null
  const left = Math.max(0, Math.round((new Date(endsAt).getTime() - now) / 1000))
  const h = Math.floor(left / 3600)
  const m = Math.floor((left % 3600) / 60)
  const sec = String(left % 60).padStart(2, '0')
  return { left, label: h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}` }
}
