import { Suspense, lazy } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { PageHeader, Spinner, cx } from '../../components/ui'
import { Icon } from '../../components/icons'

const Listen = lazy(() => import('./Listen'))
const Noise = lazy(() => import('./Noise'))
const Breathe = lazy(() => import('./Breathe'))
const Chess = lazy(() => import('./games/Chess'))
const Sudoku = lazy(() => import('./games/Sudoku'))
const Crossword = lazy(() => import('./games/Crossword'))

const TABS = [
  { to: 'listen', label: 'Listen', icon: 'headphones' },
  { to: 'sounds', label: 'Calming sounds', icon: 'wave' },
  { to: 'breathe', label: 'Breathe', icon: 'wind' },
  { to: 'chess', label: 'Chess', icon: 'puzzle' },
  { to: 'sudoku', label: 'Sudoku', icon: 'puzzle' },
  { to: 'crossword', label: 'Crossword', icon: 'puzzle' },
]

export default function Wellbeing() {
  return (
    <div>
      <PageHeader title="Rest & recharge" subtitle="Everything here runs on the court’s own server. Take whatever break you need." />
      <nav aria-label="Wellbeing" className="mb-8 flex flex-wrap gap-2 border-b border-line pb-3">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={`/juror/wellbeing/${t.to}`}
            className={({ isActive }) => cx('flex items-center gap-2 rounded-lg px-4 py-2 font-semibold', isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-ink')}
          >
            <Icon name={t.icon} size={18} /> {t.label}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route index element={<Navigate to="/juror/wellbeing/listen" replace />} />
          <Route path="listen" element={<Listen />} />
          <Route path="sounds" element={<Noise />} />
          <Route path="breathe" element={<Breathe />} />
          <Route path="chess" element={<Chess />} />
          <Route path="sudoku" element={<Sudoku />} />
          <Route path="crossword" element={<Crossword />} />
        </Routes>
      </Suspense>
    </div>
  )
}
