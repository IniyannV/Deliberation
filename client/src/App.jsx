import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import ErrorBoundary from './components/ErrorBoundary'
import RequireRole from './components/RequireRole'
import { Spinner, Toaster } from './components/ui'
import { homeFor, useAuth } from './store/auth'
import { unreadRequestReplies, useLive } from './store/live'
import Login from './pages/Login'
import Tour from './features/tour/Tour'

const JurorHome = lazy(() => import('./pages/JurorHome'))
const ExhibitLocker = lazy(() => import('./features/evidence/ExhibitLocker'))
const ExhibitPage = lazy(() => import('./features/evidence/ExhibitPage'))
const SplitReview = lazy(() => import('./features/evidence/SplitReview'))
const TimelinePage = lazy(() => import('./features/timeline/TimelinePage'))
const VotingPage = lazy(() => import('./features/voting/VotingPage'))
const RequestsPage = lazy(() => import('./features/requests/RequestsPage'))
const NotesPage = lazy(() => import('./features/notes/NotesPage'))
const ProjectorPage = lazy(() => import('./features/projector/ProjectorPage'))
const Display = lazy(() => import('./pages/display/Display'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminRequests = lazy(() => import('./pages/admin/Requests'))
const AdminEvidence = lazy(() => import('./pages/admin/Evidence'))
const AdminJurors = lazy(() => import('./pages/admin/Jurors'))
const AdminCatalog = lazy(() => import('./pages/admin/Catalog'))
const AdminAudit = lazy(() => import('./pages/admin/Audit'))

const JUROR_ROLES = ['juror', 'foreperson']

function JurorShell() {
  const isForeperson = useAuth((s) => s.user?.role === 'foreperson')
  const openToVote = useLive((s) => s.votes.filter((v) => v.status === 'open' && !s.votedIn.includes(v.id)).length)
  const pendingProposals = useLive((s) => (s.timelineProposals ?? []).length)
  const replies = useLive(unreadRequestReplies)
  const nav = [
    { to: '/juror', label: 'Overview', icon: 'home', end: true },
    { section: 'Evidence' },
    { to: '/juror/evidence', label: 'Exhibit locker', icon: 'folder' },
    { to: '/juror/timeline', label: 'Timeline', icon: 'timeline', badge: isForeperson ? pendingProposals : 0 },
    { to: '/juror/notes', label: 'My notes', icon: 'note' },
    { section: 'Deliberation' },
    { to: '/juror/voting', label: 'Ballots and Charges', icon: 'vote', badge: openToVote },
    ...(isForeperson ? [{ to: '/juror/projector', label: 'Room projector', icon: 'monitor' }] : []),
    { to: '/juror/requests', label: 'Requests', icon: 'bell', badge: replies },
  ]
  return <AppShell nav={nav} />
}

function AdminShell() {
  const pending = useLive((s) => s.queue.filter((r) => r.status === 'pending').length)
  const nav = [
    { to: '/admin', label: 'Dashboard', icon: 'home', end: true },
    { to: '/admin/requests', label: 'Request queue', icon: 'bell', badge: pending },
    { section: 'Case' },
    { to: '/admin/evidence', label: 'Evidence', icon: 'upload' },
    { to: '/admin/jurors', label: 'Juror seats', icon: 'users' },
    { section: 'Jurors' },
    { to: '/admin/catalog', label: 'Menu & supplies', icon: 'utensils' },
    { section: 'Records' },
    { to: '/admin/audit', label: 'Audit log', icon: 'shield' },
  ]
  return <AppShell nav={nav} />
}

function RootRedirect() {
  const { user, status } = useAuth()
  if (status === 'loading') return <Spinner />
  return <Navigate to={homeFor(user?.role)} replace />
}

export default function App() {
  return (
    <ErrorBoundary fullScreen>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/juror" element={<RequireRole roles={JUROR_ROLES}><JurorShell /></RequireRole>}>
            <Route index element={<JurorHome />} />
            <Route path="evidence" element={<ExhibitLocker />} />
            <Route path="evidence/:id" element={<ExhibitPage />} />
            <Route path="review" element={<SplitReview />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="voting" element={<VotingPage />} />
            <Route path="projector" element={<RequireRole roles={['foreperson']}><ProjectorPage /></RequireRole>} />
            <Route path="requests" element={<RequestsPage />} />
          </Route>
          <Route path="/display" element={<RequireRole roles={['display']}><Display /></RequireRole>} />
          <Route path="/admin" element={<RequireRole roles={['bailiff']}><AdminShell /></RequireRole>}>
            <Route index element={<AdminDashboard />} />
            <Route path="requests" element={<AdminRequests />} />
            <Route path="evidence" element={<AdminEvidence />} />
            <Route path="jurors" element={<AdminJurors />} />
            <Route path="catalog" element={<AdminCatalog />} />
            <Route path="audit" element={<AdminAudit />} />
          </Route>
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </Suspense>
      <Tour />
      <Toaster />
    </ErrorBoundary>
  )
}
