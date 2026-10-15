import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Icon } from './icons'
import { Button, cx } from './ui'
import { useAuth } from '../store/auth'
import { useLive } from '../store/live'
import { useUi } from '../store/ui'
import { tourOffered, useTour } from '../features/tour/Tour'
import { store } from '../lib/storage'

/**
 * Persistent left sidebar plus a scrolling content area.
 * `nav` is a list of { to, label, icon, end?, badge?, children? } or { section }.
 */
export default function AppShell({ nav, wide = false }) {
  const { user, caseInfo, logout } = useAuth()
  const connected = useLive((s) => s.connected)
  const { theme, toggleTheme } = useUi()
  const navigate = useNavigate()
  const startTour = useTour((s) => s.start)
  const tourActive = useTour((s) => s.active)
  const [offer, setOffer] = useState(() => !tourOffered())
  const dismissOffer = () => { setOffer(false); store('tourOffered', true) }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-surface xl:w-72">
        <div className="px-5 pt-6 pb-4">
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">Deliberation Room</p>
          {caseInfo && (
            <p className="mt-1 leading-snug font-bold">
              {caseInfo.caption}
              <span className="block text-sm font-normal text-muted">{caseInfo.caseNumber}</span>
            </p>
          )}
        </div>

        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin" data-tour="sidebar">
          <ul className="flex flex-col gap-0.5">
            {nav.map((item) =>
              item.section ? (
                <li key={item.section} className="mt-5 mb-1 px-3 text-xs font-bold tracking-wider text-muted uppercase">
                  {item.section}
                </li>
              ) : (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cx(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 font-semibold',
                        isActive ? 'bg-accent-soft text-accent' : 'text-ink/85 hover:bg-surface-2',
                      )
                    }
                  >
                    <Icon name={item.icon} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-accent px-2 text-sm text-accent-ink" aria-label={`${item.badge} new`}>
                        {item.badge}
                      </span>
                    ) : null}
                  </NavLink>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="border-t border-line p-4">
          <button
            type="button"
            data-tour="tour-button"
            onClick={() => { setOffer(false); startTour(user?.role) }}
            className="mb-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-accent hover:bg-accent-soft"
          >
            <Icon name="compass" size={18} /> Guided tour
          </button>
          <div className="mb-3 flex items-center gap-2">
            <span
              className={cx('h-2.5 w-2.5 rounded-full', connected ? 'bg-ok' : 'bg-warn')}
              aria-hidden
            />
            <span className="text-sm text-muted">{connected ? 'Connected to court server' : 'Reconnecting…'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{user?.name}</p>
              <p className="text-sm text-muted capitalize">{user?.role}</p>
            </div>
            <div className="flex">
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              >
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
              </button>
              <button
                type="button"
                onClick={async () => { await logout(); navigate('/login') }}
                className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink"
                aria-label="Sign out"
                title="Sign out"
              >
                <Icon name="logout" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className={cx('mx-auto px-8 py-8 xl:px-10', wide ? 'max-w-none' : 'max-w-6xl')}>
          <Outlet />
        </div>
      </main>

      {offer && !tourActive && (
        <div role="dialog" aria-label="Guided tour" className="fixed bottom-6 left-[17rem] z-40 w-80 rounded-2xl border border-line bg-surface p-5 shadow-xl xl:left-[19rem]">
          <p className="flex items-center gap-2 font-bold"><Icon name="compass" /> New here?</p>
          <p className="mt-1 text-muted">Take a two-minute guided tour of everything on this screen. You can restart it later from the sidebar.</p>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" size="sm" onClick={() => { setOffer(false); startTour(user?.role) }}>Start the tour</Button>
            <Button variant="ghost" size="sm" onClick={dismissOffer}>No thanks</Button>
          </div>
        </div>
      )}
    </div>
  )
}
