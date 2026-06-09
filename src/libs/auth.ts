export type UserRole = 'user' | 'admin' | 'super_admin'

export interface JwtClaims {
  username: string
  user_id: number
  role: UserRole
  exp: number
  iat: number
}

export function getToken(): string | null {
  return localStorage.getItem('jwt')
}

export function clearToken() {
  localStorage.removeItem('jwt')
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  return atob(padded)
}

export function decodeToken(token = getToken()): JwtClaims | null {
  if (!token) return null

  try {
    const payload = JSON.parse(decodeBase64Url(token.split('.')[1])) as JwtClaims
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearToken()
      return null
    }
    return payload
  } catch {
    clearToken()
    return null
  }
}

export function isAdminRole(role?: string): boolean {
  return role === 'admin' || role === 'super_admin'
}

export function isSuperAdminRole(role?: string): boolean {
  return role === 'super_admin'
}
