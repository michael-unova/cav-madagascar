import { Navigate } from 'react-router-dom'

export function AuthPlaceholderPage() {
  return <Navigate to="/login" replace />
}
