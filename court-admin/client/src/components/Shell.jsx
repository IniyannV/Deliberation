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

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 flex h-dvh w-64 shrink-0 flex-col border-r border-line/60 bg-sidebar px-3 py-5 print:hidden">
        <div className="mb-6 flex items-center gap-2.5 px-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-b from-[#3b8cff] to-[#0062d6] text-white"><Icon name="scale" size={20} /></span>
          <div className="leading-tight">
            <p className="font-bold">Court Admin</p>
            <p className="text-xs text-muted">Prepare cases for the jury room</p>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.filter((n) => !n.admin || user.role === 'admin').map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-3 py-2 font-medium', isActive ? 'bg-accent text-accent-ink' : 'text-ink hover:bg-fill')}
            >
              <Icon name={n.icon} size={19} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-1 border-t border-line/60 px-1 pt-4">
          <NavLink to="/account" className="min-w-0 flex-1 rounded-lg px-2 py-1 hover:bg-fill" title="Your account">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.username} · {user.role}</p>
          </NavLink>
          <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} label={theme === 'dark' ? 'Light appearance' : 'Dark appearance'} onClick={toggleTheme} />
          <IconButton icon="logout" label="Sign out" onClick={async () => { await logout(); navigate('/login') }} />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-10 py-8 print:p-0">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
