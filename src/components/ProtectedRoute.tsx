import { Navigate, Outlet } from 'react-router-dom'

export default function ProtectedRoute() {
  const token = localStorage.getItem('jwt')
  if (!token) {
    return <Navigate to="/login" replace />
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('jwt')
      return <Navigate to="/login" replace />
    }
  } catch {
    localStorage.removeItem('jwt')
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
