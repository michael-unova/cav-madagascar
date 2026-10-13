import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { AdminNav } from '../../components/AdminNav'

export function AdminRoute() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="auth-loading">Chargement...</div>
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  if (profile?.status === 'suspended') return <Navigate to="/account-suspended" replace />

  const role = profile?.role
  if (role !== 'content_manager' && role !== 'super_admin') return <Navigate to="/admin/unauthorized" replace />
  // Analytics exposes platform-wide financial and operational metrics to super admins only.
  if (location.pathname === '/admin/analytics' && role !== 'super_admin') return <Navigate to="/admin/unauthorized" replace />

  return <><AdminNav /><Outlet /></>
}
