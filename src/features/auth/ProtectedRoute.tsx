import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { LoadingState } from '../../components/LoadingState/LoadingState'
import { paths, roleDashboardPaths } from '../../routes/paths'
import { useAuth } from './useAuth'
import type { UserRole } from '../../types'

export interface ProtectedRouteProps {
  children: ReactNode
  /**
   * If provided, only these roles may view this route. A signed-in user
   * with a different role is sent to their own dashboard rather than
   * shown an error: this guard only protects navigation, real
   * authorization for data still lives in Firestore Security Rules.
   */
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingState label="Vérification de votre session" />
  }

  if (!user) {
    return <Navigate to={paths.login} replace state={{ from: location }} />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleDashboardPaths[user.role]} replace />
  }

  return <>{children}</>
}
