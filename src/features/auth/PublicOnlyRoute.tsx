import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function PublicOnlyRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="auth-loading">Chargement...</div>
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
