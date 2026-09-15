import { Navigate } from 'react-router-dom'
import { paths } from '../../routes/paths'

/**
 * Temporary default landing point for the generic /dashboard route.
 * Once Milestone 2 resolves the signed in user's real role, this will
 * redirect to the correct role-specific dashboard instead of always
 * defaulting to the student view.
 */
export function DashboardRedirect() {
  return <Navigate to={paths.dashboardStudent} replace />
}
