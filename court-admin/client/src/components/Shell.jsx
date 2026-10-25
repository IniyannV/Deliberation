import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useUi } from '../store/ui'
import { Icon } from './icons'
import { IconButton, cx } from './ui'

const NAV = [
  { to: '/cases', label: 'Cases', icon: 'gavel' },
  { to: '/catalog', label: 'Menu & supplies', icon: 'utensils' },
  { to: '/users', label: 'Accounts', icon: 'users', admin: true },
  { to: '/audit', label: 'Audit log', icon: 'shield' },
]

/** Sidebar and page frame for everything behind sign-in. Built for office desktops. */
export default function Shell() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const { theme, toggleTheme } = useUi()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cx(
          'sticky top-0 flex h-dvh w-64 shrink-0 flex-col border-r border-line/60 bg-sidebar px-3 py-5 print:hidden transition-all duration-300 ease-[var(--ease-fluid)]',
          sidebarOpen ? 'translate-x-0' : '-ml-64 -translate-x-full pointer-events-none'
        )}
        aria-hidden={!sidebarOpen ? true : undefined}
      >
        <div className="mb-6 flex items-center justify-between gap-2 px-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-b from-[#3b8cff] to-[#0062d6] text-white">
              <Icon name="scale" size={20} />
            </span>
            <div className="leading-tight min-w-0">
              <p className="font-bold truncate">Court Admin</p>
              <p className="text-xs text-muted truncate">Prepare cases</p>
            </div>
          </div>
          <IconButton
            icon="sidebar"
            label="Hide sidebar"
            className="text-accent shrink-0"
            onClick={closeSidebar}
          />
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.filter((n) => !n.admin || user.role === 'admin').map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              onClick={closeSidebar}
              className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-3 py-2 font-medium', isActive ? 'bg-accent text-accent-ink' : 'text-ink hover:bg-fill')}
            >
              <Icon name={n.icon} size={19} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-1 border-t border-line/60 px-1 pt-4">
          <NavLink to="/account" onClick={closeSidebar} className="min-w-0 flex-1 rounded-lg px-2 py-1 hover:bg-fill" title="Your account">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.username} · {user.role}</p>
          </NavLink>
          <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} label={theme === 'dark' ? 'Light appearance' : 'Dark appearance'} onClick={toggleTheme} />
          <IconButton icon="logout" label="Sign out" onClick={async () => { await logout(); navigate('/login') }} />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-6 py-6 md:px-10 md:py-8 print:p-0 transition-all duration-300">
        <div className="mx-auto max-w-6xl">
          {!sidebarOpen && (
            <div className="mb-6 flex items-center gap-2">
              <IconButton
                icon="sidebar"
                label="Show sidebar"
                className="text-accent"
                onClick={() => setSidebarOpen(true)}
              />
              <span className="text-xs font-semibold text-muted">Show navigation</span>
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  )
}
