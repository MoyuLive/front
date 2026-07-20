import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { decodeToken, UserRole } from '../libs/auth'

interface ProtectedRouteProps {
  roles?: UserRole[]
}

export default function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const location = useLocation()
  const payload = decodeToken()
  if (!payload) {
    const returnPath = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(returnPath)}`} replace />
  }

  if (roles && !roles.includes(payload.role)) {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}
