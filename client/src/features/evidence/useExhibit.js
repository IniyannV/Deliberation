import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

const cache = new Map()

/** Full exhibit record (including transcript lines), cached per session. */
export function useExhibit(id) {
  const [state, setState] = useState(() => ({ exhibit: cache.get(id) ?? null, error: '' }))

  useEffect(() => {
    if (!id) return setState({ exhibit: null, error: '' })
    if (cache.has(id)) return setState({ exhibit: cache.get(id), error: '' })
    let alive = true
    setState({ exhibit: null, error: '' })
    api(`/exhibits/${id}`)
      .then(({ exhibit }) => {
        cache.set(id, exhibit)
        if (alive) setState({ exhibit, error: '' })
      })
      .catch((err) => alive && setState({ exhibit: null, error: err.message }))
    return () => { alive = false }
  }, [id])

  return state
}

export const clearExhibitCache = () => cache.clear()
