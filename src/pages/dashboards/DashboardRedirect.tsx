import { Navigate } from 'react-router-dom'
import { LoadingState } from '../../components/LoadingState/LoadingState'
import { paths, roleDashboardPaths } from '../../routes/paths'
import { useAuth } from '../../features/auth/useAuth'

/**
 * Landing point for the generic /dashboard route. Redirects to the
 * signed-in user's real role-specific dashboard, now that Milestone 2
 * resolves the user's role from their Firestore profile. This route is
 * always rendered behind `ProtectedRoute`, but the unauthenticated case is
 * still handled defensively.
 */
export function DashboardRedirect() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingState label="Chargement de votre tableau de bord" />
  }

  if (!user) {
    return <Navigate to={paths.login} replace />
  }

  return <Navigate to={roleDashboardPaths[user.role]} replace />
}
