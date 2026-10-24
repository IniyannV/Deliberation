import { useEffect, useState } from 'react'

const getLeft = (endsAt) => {
  if (!endsAt) return 0
  return Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000))
}

const formatLeft = (left) => {
  const h = Math.floor(left / 3600)
  const m = Math.floor((left % 3600) / 60)
  const sec = String(left % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** Time left until `endsAt`, as m:ss (or h:mm:ss). */
export function useCountdown(endsAt) {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!endsAt) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [endsAt])

  if (!endsAt) return null

  const left = getLeft(endsAt)
  return { left, label: formatLeft(left) }
}
