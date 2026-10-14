import { Navigate, useLocation } from 'react-router-dom'
import { homeFor, useAuth } from '../store/auth'
import { Spinner } from './ui'

/** UI-side routing only. The server independently enforces every role check. */
export default function RequireRole({ roles, children }) {
  const { user, status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <Spinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />
  return children
}
