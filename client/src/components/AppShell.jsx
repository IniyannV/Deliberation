import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from './icons'
import { Button, IconButton, cx } from './ui'
import ErrorBoundary from './ErrorBoundary'
import { TitleBarContext } from './titleBar'
import TextSize from './TextSize'
import { useAuth } from '../store/auth'
import { useLive } from '../store/live'
import { useUi } from '../store/ui'
import { tourOffered, useTour } from '../features/tour/Tour'
import { store } from '../lib/storage'

// Apple's momentum projection: where a flick would come to rest.
const project = (v, d = 0.998) => ((v / 1000) * d) / (1 - d)
const rubberband = (x, dim, c = 0.55) => (x * dim * c) / (dim + c * Math.abs(x))

// Wide enough to keep the sidebar beside the page: iPad landscape (1180 pt) and
// up. In iPad portrait (820 pt) it slides over the page instead, like iPadOS apps.
const DOCKED = '(min-width: 64rem)'

/**
 * The narrow-screen sidebar is a drawer you can drag. It tracks the finger
 * 1:1 from where it was grabbed, resists being pulled past open, and on
 * release uses the flick's velocity to decide whether it closes.
 */
function useDrawerDrag(open, setOpen) {
  const [dx, setDx] = useState(null)
  const onPointerDown = useCallback((e) => {
    if (!open || e.pointerType === 'mouse' || window.matchMedia(DOCKED).matches) return
    const panel = e.currentTarget
    const width = panel.offsetWidth
    const x0 = e.clientX
    const y0 = e.clientY
    let tracking = false
    let samples = [{ x: x0, t: performance.now() }]
    const move = (ev) => {
      const d = ev.clientX - x0
      if (!tracking) {
        // A little hysteresis, and only claim horizontal gestures.
        if (Math.abs(d) < 10 || Math.abs(d) < Math.abs(ev.clientY - y0)) return
        tracking = true
        panel.setPointerCapture?.(e.pointerId)
      }
      samples = [...samples.slice(-4), { x: ev.clientX, t: performance.now() }]
      setDx(d > 0 ? rubberband(d, width) : d)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!tracking) return
      const a = samples[0]
      const b = samples[samples.length - 1]
      const v = b.t > a.t ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0
      const resting = b.x - x0 + project(v)
      setDx(null)
      if (resting < -width / 2) setOpen(false)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }, [open, setOpen])
  return { dx, onPointerDown }
}

/**
 * A floating translucent sidebar beside a scrolling content area, with a
 * title bar that materializes once content scrolls beneath it.
 * `nav` is a list of { to, label, icon, end?, badge? } or { section }.
 */
export default function AppShell({ nav, wide = false }) {
  const { user, caseInfo, logout } = useAuth()
  const connected = useLive((s) => s.connected)
  const { theme, toggleTheme, sidebarCollapsed: collapsed, setSidebarCollapsed } = useUi()
  const navigate = useNavigate()
  const location = useLocation()
  const startTour = useTour((s) => s.start)
  const tourActive = useTour((s) => s.active)
  const [offer, setOffer] = useState(() => !tourOffered())
  const dismissOffer = () => { setOffer(false); store('tourOffered', true) }

  const [compact, setCompact] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const main = useRef(null)
  const { dx, onPointerDown } = useDrawerDrag(drawer, setDrawer)

  // Each page starts at the top, with the sidebar put away (unless the tour,
  // which walks through pages, needs it showing).
  useEffect(() => {
    setDrawer(false)
    if (!useTour.getState().active) setSidebarCollapsed(true)
    main.current?.scrollTo({ top: 0 })
  }, [location.pathname, setSidebarCollapsed])

  // The tour points at things in the sidebar, so bring it back while the tour runs.
  // Where it's a drawer (iPad portrait), slide it out just for the sidebar step.
  const tourOnSidebar = useTour((s) => s.active && s.steps[s.index]?.target === 'sidebar')
  useEffect(() => {
    if (tourActive) setSidebarCollapsed(false)
  }, [tourActive, setSidebarCollapsed])
  useEffect(() => {
    if (!window.matchMedia(DOCKED).matches) setDrawer(tourOnSidebar)
  }, [tourOnSidebar])

  useEffect(() => {
    if (!drawer) return
    const key = (e) => e.key === 'Escape' && setDrawer(false)
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [drawer])

  const initials = (user?.name ?? '?').replace(/^Juror\s+/i, '').slice(0, 2).toUpperCase()

  return (
    <TitleBarContext.Provider value={setCompact}>
      {/* Safe-area padding: the Home Screen app runs edge to edge (viewport-fit=cover). */}
      <div className="flex h-dvh overflow-hidden pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
        {/* Scrim for the narrow-screen drawer. Dims to focus, fades with the drag. */}
        <div
          aria-hidden
          onClick={() => setDrawer(false)}
          className={cx('fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 lg:hidden', drawer ? 'opacity-100' : 'pointer-events-none opacity-0')}
          style={dx != null ? { opacity: Math.max(0, 1 + Math.min(0, dx) / 288), transition: 'none' } : undefined}
        />

        <aside
          onPointerDown={onPointerDown}
          className={cx(
            'material-bar drawer motion-travel fixed inset-y-2 left-2 z-50 flex w-[17rem] shrink-0 flex-col overflow-hidden rounded-[1.375rem] shadow-[var(--shadow-float)]',
            'transition-transform duration-[var(--duration-ui)] ease-[var(--ease-fluid)]',
            'lg:relative lg:inset-auto lg:my-2 lg:ml-2 lg:shadow-card lg:transition-[transform,margin] xl:w-[18rem]',
            drawer ? 'translate-x-0' : '-translate-x-[calc(100%+5rem)]',
            // Collapsed on a wide screen: slide out and give up its space, so content takes the full width.
            collapsed ? 'lg:-mr-[17.5rem] lg:-translate-x-[calc(100%+1rem)] xl:-mr-[18.5rem]' : 'lg:translate-x-0',
          )}
          aria-hidden={collapsed && !drawer ? true : undefined}
          inert={collapsed && !drawer ? true : undefined}
          style={dx != null ? { transform: `translateX(${dx}px)`, transition: 'none' } : undefined}
        >
          <div className="flex items-center gap-3 px-4 pt-5 pb-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.7rem] bg-linear-to-b from-[#3b8cff] to-[#0062d6] text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.4),0_1px_3px_rgb(0_0_0/0.2)]">
              <Icon name="scale" size={22} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-muted">Deliberation</p>
              {caseInfo && <p className="truncate leading-tight font-semibold" title={caseInfo.caption}>{caseInfo.caption}</p>}
              {caseInfo && <p className="text-xs text-muted tabular-nums">{caseInfo.caseNumber}</p>}
            </div>
            <IconButton
              icon="sidebar"
              label="Hide sidebar"
              className="-mr-1.5 -mt-4 self-start text-accent"
              onClick={() => (drawer ? setDrawer(false) : setSidebarCollapsed(true))}
            />
          </div>

          <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 scrollbar-thin" data-tour="sidebar">
            <ul className="flex flex-col gap-px">
              {nav.map((item) =>
                item.section ? (
                  <li key={item.section} className="mt-4 mb-1 px-3 text-[0.8125rem] font-semibold text-muted">
                    {item.section}
                  </li>
                ) : (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cx(
                          'pressable pressable-soft group flex items-center gap-3 rounded-[0.625rem] px-3 py-[0.45rem]',
                          isActive ? 'bg-accent font-semibold text-accent-ink' : 'text-ink hover:bg-fill',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon name={item.icon} size={20} strokeWidth={2} className={isActive ? 'text-accent-ink' : 'text-accent'} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge ? (
                            <span
                              className={cx('min-w-6 rounded-full px-1.5 text-center text-sm font-semibold tabular-nums', isActive ? 'bg-white/25 text-accent-ink' : 'bg-accent text-accent-ink')}
                              aria-label={`${item.badge} new`}
                            >
                              {item.badge}
                            </span>
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  </li>
                ),
              )}
              <li className="mt-4">
                <button
                  type="button"
                  data-tour="tour-button"
                  onClick={() => { setOffer(false); setDrawer(false); startTour(user?.role) }}
                  className="pressable pressable-soft flex w-full items-center gap-3 rounded-[0.625rem] px-3 py-[0.45rem] text-ink hover:bg-fill"
                >
                  <Icon name="compass" size={20} strokeWidth={2} className="text-accent" /> Guided tour
                </button>
              </li>
            </ul>
          </nav>

          <div className="shrink-0 border-t border-line/40 pt-2.5">
            <div className="mx-2.5 mb-2 flex items-center justify-between gap-2 px-1.5">
              <span className="text-sm font-medium text-muted">Text size</span>
              <TextSize />
            </div>
            <div className="mx-2.5 mb-2.5 rounded-[0.875rem] bg-fill/60 p-2.5">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-b from-[#a1a1a6] to-[#7c7c80] text-sm font-semibold text-white" aria-hidden>
                  {initials}
                  {/* Presence dot: green while connected to the court server. */}
                  <span className={cx('absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full ring-2 ring-surface transition-colors duration-500', connected ? 'bg-ok' : 'bg-warn')} />
                </span>
                <div className="min-w-0 flex-1" title={connected ? 'Connected to court server' : 'Reconnecting to court server'}>
                  <p className="truncate leading-tight font-semibold">{user?.name}</p>
                  <p className={cx('truncate text-xs', connected ? 'text-muted capitalize' : 'font-semibold text-warn')}>
                    {connected ? user?.role : 'Reconnecting…'}
                    <span className="sr-only">{connected ? ', connected to court server' : ''}</span>
                  </p>
                </div>
                <IconButton
                  icon={theme === 'dark' ? 'sun' : 'moon'}
                  size={18}
                  label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  onClick={toggleTheme}
                />
                <IconButton icon="logout" size={18} label="Sign out" onClick={async () => { await logout(); navigate('/login') }} />
              </div>
            </div>
          </div>
        </aside>

        <main ref={main} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 2)} className="relative min-w-0 flex-1 overflow-y-auto scrollbar-thin">
          {/* Title bar: invisible at rest, a translucent material once content scrolls under it. */}
          <div className="sticky top-0 z-30 h-0">
            <div className="relative flex h-13 items-center px-3 md:px-6">
              <div
                aria-hidden
                className={cx(
                  'material-bar pointer-events-none absolute inset-x-0 top-0 h-[calc(100%+0.75rem)] transition-opacity duration-300 [mask-image:linear-gradient(to_bottom,black_75%,transparent)]',
                  scrolled ? 'opacity-100' : 'opacity-0',
                )}
              />
              <IconButton
                icon="sidebar"
                label="Show sidebar"
                className={cx('relative text-accent', !collapsed && 'lg:hidden')}
                onClick={() => (window.matchMedia(DOCKED).matches ? setSidebarCollapsed(false) : setDrawer(true))}
              />
              <p
                aria-hidden
                className={cx(
                  'pointer-events-none absolute inset-x-16 truncate text-center font-semibold transition-[opacity,translate] duration-300 ease-[var(--ease-fluid)]',
                  compact?.visible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
                )}
              >
                {compact?.title}
              </p>
              {/* With the sidebar showing, text size lives at its foot instead. */}
              <TextSize className={cx('relative ml-auto', !collapsed && 'lg:hidden')} />
            </div>
          </div>

          {/* --page-chrome: the padding above and below, for pages that fill the screen height. */}
          <div
            className={cx(
              'mx-auto px-5 pt-16 pb-10 [--page-chrome:6rem] md:px-8 xl:px-10',
              collapsed ? 'lg:pt-16' : 'lg:pt-9 lg:[--page-chrome:4rem]',
              wide ? 'max-w-none' : 'max-w-6xl',
            )}
          >
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>

        {offer && !tourActive && (
          <div
            role="dialog"
            aria-label="Guided tour"
            className={cx('material materialize fixed right-4 bottom-4 left-4 z-40 origin-bottom-left rounded-3xl p-5 md:right-auto md:w-80', !collapsed && 'lg:left-[19rem] xl:left-[20rem]')}
          >
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-[0.75rem] bg-accent-soft text-accent"><Icon name="compass" size={24} /></span>
            <p className="text-lg font-bold">New here?</p>
            <p className="mt-1 text-muted">Take a two-minute guided tour of everything on this screen. You can restart it later from the sidebar.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="primary" size="sm" onClick={() => { setOffer(false); startTour(user?.role) }}>Start the tour</Button>
              <Button variant="ghost" size="sm" onClick={dismissOffer}>Not now</Button>
            </div>
          </div>
        )}
      </div>
    </TitleBarContext.Provider>
  )
}
