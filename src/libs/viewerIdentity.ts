const GUEST_ID_STORAGE_KEY = 'yantube_guest_id'
const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function isCanonicalUuid(value: string): boolean {
  return CANONICAL_UUID_PATTERN.test(value)
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length
}

export function getOrCreateGuestId(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  randomUuid: () => string = () => crypto.randomUUID()
): string {
  const existingGuestId = storage.getItem(GUEST_ID_STORAGE_KEY)
  if (existingGuestId && isCanonicalUuid(existingGuestId)) {
    return existingGuestId
  }

  const guestId = randomUuid()
  if (!isCanonicalUuid(guestId)) {
    throw new Error('randomUuid must return a canonical UUID')
  }

  storage.setItem(GUEST_ID_STORAGE_KEY, guestId)
  return guestId
}

export function sanitizeRedirect(value: string | null, origin = window.location.origin): string {
  if (!value || !value.startsWith('/') || value.includes('\\')) {
    return '/'
  }

  try {
    const trustedOrigin = new URL(origin).origin
    const pathEnd = value.search(/[?#]/)
    let decodedPath = pathEnd === -1 ? value : value.slice(0, pathEnd)

    for (let pass = 0; pass <= decodedPath.length; pass += 1) {
      if (!decodedPath.startsWith('/') || decodedPath.startsWith('//') || decodedPath.includes('\\')) {
        return '/'
      }

      if (new URL(decodedPath, trustedOrigin).origin !== trustedOrigin) {
        return '/'
      }

      const nextPath = decodeURIComponent(decodedPath)
      if (nextPath === decodedPath) {
        break
      }
      decodedPath = nextPath
    }

    const redirectUrl = new URL(value, trustedOrigin)
    if (redirectUrl.origin !== trustedOrigin) {
      return '/'
    }
    return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`
  } catch {
    return '/'
  }
}

export function unicodeLength(value: string): number {
  return Array.from(value).length
}

export function accountValidationError(username: string, password: string): string | null {
  if (utf8Length(username) < 3 || utf8Length(username) > 32) {
    return '用户名必须为 3-32 个字节'
  }
  if (!/^[\p{L}\p{N}_]+$/u.test(username)) {
    return '用户名只能包含字母、数字或下划线'
  }
  if (utf8Length(password) < 6) {
    return '密码至少需要 6 个字节'
  }
  return null
}
