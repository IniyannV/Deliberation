// localStorage for per-device conveniences only (theme, pane widths). Never required.
export function load(key, fallback) {
  try {
    const v = localStorage.getItem(`ca:${key}`)
    return v === null ? fallback : JSON.parse(v)
  } catch {
    return fallback
  }
}

export function store(key, value) {
  try {
    localStorage.setItem(`ca:${key}`, JSON.stringify(value))
  } catch {
    // ignore
  }
}
