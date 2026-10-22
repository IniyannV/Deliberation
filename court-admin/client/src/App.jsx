import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './store/auth'
import { Spinner, Toaster } from './components/ui'
import Shell from './components/Shell'
import Login from './pages/Login'
import Cases from './pages/Cases'
import CaseLayout from './pages/case/CaseLayout'
import CaseDetails from './pages/case/CaseDetails'
import CaseCharges from './pages/case/CaseCharges'
import CaseEvidence from './pages/case/CaseEvidence'
import CaseJury from './pages/case/CaseJury'
import CaseExport from './pages/case/CaseExport'
import Catalog from './pages/Catalog'
import Users from './pages/Users'
import Audit from './pages/Audit'
import Account from './pages/Account'

function Protected({ children, admin = false }) {
  const user = useAuth((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (admin && user.role !== 'admin') return <Navigate to="/cases" replace />
  return children
}

export default function App() {
  const { ready, user } = useAuth()
  if (!ready) return <Spinner />
  return (
    <>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/cases" replace /> : <Login />} />
        <Route element={<Protected><Shell /></Protected>}>
          <Route path="/cases" element={<Cases />} />
          <Route path="/cases/:id" element={<CaseLayout />}>
            <Route index element={<CaseDetails />} />
            <Route path="charges" element={<CaseCharges />} />
            <Route path="evidence" element={<CaseEvidence />} />
            <Route path="jury" element={<CaseJury />} />
            <Route path="export" element={<CaseExport />} />
          </Route>
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/users" element={<Protected admin><Users /></Protected>} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/account" element={<Account />} />
        </Route>
        <Route path="*" element={<Navigate to="/cases" replace />} />
      </Routes>
      <Toaster />
    </>
  )
}
