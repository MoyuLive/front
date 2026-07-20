import { accountValidationError, getOrCreateGuestId, sanitizeRedirect } from './viewerIdentity.js'

function assertEqual(actual: string | null, expected: string | null) {
  if (actual !== expected) {
    throw new Error(`expected ${expected}, got ${actual}`)
  }
}

function createMemoryStorage(initialValue: string | null = null): Pick<Storage, 'getItem' | 'setItem'> {
  let value = initialValue
  return {
    getItem: () => value,
    setItem: (_, nextValue) => {
      value = nextValue
    }
  }
}

const firstStorage = createMemoryStorage()
const firstGuestId = getOrCreateGuestId(
  firstStorage,
  () => '550e8400-e29b-41d4-a716-446655440000'
)
assertEqual(firstGuestId, '550e8400-e29b-41d4-a716-446655440000')
assertEqual(firstStorage.getItem('yantube_guest_id') || '', firstGuestId)

const reusedGuestId = getOrCreateGuestId(
  firstStorage,
  () => {
    throw new Error('should not generate a replacement UUID')
  }
)
assertEqual(reusedGuestId, firstGuestId)

const invalidStorage = createMemoryStorage('not-a-uuid')
const replacementGuestId = getOrCreateGuestId(
  invalidStorage,
  () => '123e4567-e89b-42d3-a456-426614174000'
)
assertEqual(replacementGuestId, '123e4567-e89b-42d3-a456-426614174000')
assertEqual(invalidStorage.getItem('yantube_guest_id') || '', replacementGuestId)

const origin = 'https://yantube.example'
assertEqual(sanitizeRedirect('/live/room-1?x=1#chat', origin), '/live/room-1?x=1#chat')
assertEqual(sanitizeRedirect('/admin', origin), '/admin')
assertEqual(sanitizeRedirect('https://evil.test', origin), '/')
assertEqual(sanitizeRedirect('//evil.test', origin), '/')
assertEqual(sanitizeRedirect('javascript:alert(1)', origin), '/')
assertEqual(sanitizeRedirect('\\admin', origin), '/')
assertEqual(sanitizeRedirect('/%2F%2Fevil.test', origin), '/')
assertEqual(sanitizeRedirect('/%5C%5Cevil.test', origin), '/')
assertEqual(sanitizeRedirect('/%252F%252Fevil.test', origin), '/')
assertEqual(sanitizeRedirect('/%09%2F%2Fevil.test', origin), '/')
assertEqual(sanitizeRedirect(null, origin), '/')

assertEqual(accountValidationError('é', '123456'), '用户名必须为 3-32 个字节')
assertEqual(accountValidationError('你', '123456'), null)
assertEqual(accountValidationError('a'.repeat(32), '123456'), null)
assertEqual(accountValidationError('a'.repeat(33), '123456'), '用户名必须为 3-32 个字节')
assertEqual(accountValidationError('用户１２3_é', '123456'), null)
assertEqual(accountValidationError('user-name', '123456'), '用户名只能包含字母、数字或下划线')
assertEqual(accountValidationError('viewer', '密ab'), '密码至少需要 6 个字节')
assertEqual(accountValidationError('viewer', '密码'), null)
