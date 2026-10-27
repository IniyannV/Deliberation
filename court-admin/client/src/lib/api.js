// Thin fetch wrapper. Every request goes to this same origin (the Court Admin server).

export const DEMO_ADMIN_HOST = 'deliberation-admin.soumilvoona.me'
export const isDemoAdminDomain = () => typeof window !== 'undefined' && window.location.hostname === DEMO_ADMIN_HOST

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

export async function api(path, { method = 'GET', body, form } = {}) {
  const m = method.toUpperCase()
  if (isDemoAdminDomain()) {
    if (m === 'DELETE' && path.startsWith('/cases/')) {
      const err = new Error('Public demo domain, so deleting cases is not allowed')
      err.status = 403
      throw err
    }
    if (path.includes('/reset-password') || path.startsWith('/auth/password')) {
      const err = new Error('Public demo domain, so changing passwords is not allowed')
      err.status = 403
      throw err
    }
  }
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized()
    const err = new Error(data.error || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

/**
 * Upload with progress (fetch can't report it). Large trial videos take a
 * while, so the clerk sees how far along the upload is.
 */
export function uploadWithProgress(path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api${path}`)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => {
      let data = {}
      try { data = JSON.parse(xhr.responseText) } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data)
      if (xhr.status === 401) onUnauthorized()
      reject(new Error(data.error || `Upload failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Could not reach the Court Admin server.'))
    xhr.send(form)
  })
}

export const exhibitFileUrl = (id, { download = false } = {}) => `/api/cases/exhibits/${id}/file${download ? '?download=1' : ''}`
