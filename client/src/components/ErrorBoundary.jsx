import { Component } from 'react'
import { Icon } from './icons'
import { Button, cx } from './ui'

// A lazy page whose chunk didn't arrive (Wi-Fi blip, or the app was updated
// underneath an open tab). Chrome and Safari word it differently.
const isChunkError = (e) => /dynamically imported module|module script failed|Loading chunk/i.test(e?.message ?? '')

/**
 * Catches a render-time exception below it and shows a card in its place,
 * so one broken page doesn't blank the whole app. Changing `resetKey`
 * (the page's path) clears the error, so navigating away recovers.
 * `fullScreen` is for the top level, where there's no app shell around it.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Page failed to render', error, info?.componentStack)
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const chunk = isChunkError(error)
    return (
      <div role="alert" className={cx('flex items-center justify-center px-6', this.props.fullScreen ? 'min-h-dvh' : 'py-16')}>
        <div className="flex max-w-md flex-col items-center rounded-3xl bg-surface px-8 py-10 text-center shadow-card">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-[1rem] bg-warn-soft text-warn">
            <Icon name="alert" size={30} strokeWidth={1.8} />
          </span>
          <p className="text-[1.375rem] font-bold tracking-tight">
            {chunk ? 'This page didn’t finish loading' : 'Something went wrong on this page'}
          </p>
          <p className="mt-1.5 text-muted">
            {chunk
              ? 'The connection to the court server may have dropped for a moment. Reload to try again.'
              : this.props.fullScreen
                ? 'Reload to start again. If it keeps happening, let the bailiff know.'
                : 'Reload to try again, or choose another section from the sidebar. If it keeps happening, let the bailiff know.'}
          </p>
          <Button variant="primary" size="lg" icon="refresh" className="mt-6" onClick={() => window.location.reload()}>
            Reload
          </Button>
          {error.message && <p className="mt-5 max-w-full text-xs break-words text-muted/80">{error.message}</p>}
        </div>
      </div>
    )
  }
}
