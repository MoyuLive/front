import { Navigate, Outlet } from 'react-router-dom'

import { decodeToken, UserRole } from '../libs/auth'

interface ProtectedRouteProps {
  roles?: UserRole[]
}

export default function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const payload = decodeToken()
  if (!payload) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(payload.role)) {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}
