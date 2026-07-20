import assert from 'node:assert/strict'
import test from 'node:test'

import { createServer } from 'vite'

test('logout 401 neither refreshes the token nor forces a login navigation', { timeout: 5000 }, async () => {
  const originalFetch = globalThis.fetch
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const originalWindow = globalThis.window
  const requests = []
  let tokenRemoveCount = 0

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => key === 'jwt' ? 'test-session-token' : null,
      setItem() {},
      removeItem: (key) => {
        if (key === 'jwt') tokenRemoveCount += 1
      }
    }
  })
  globalThis.window = { location: { href: '/' } }
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method ?? 'GET' })
    return new Response(
      JSON.stringify({ code: 401, msg: 'not authenticated', data: null }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const vite = await createServer({
    appType: 'custom',
    server: { hmr: false, middlewareMode: true }
  })

  try {
    const { ApiError, logout } = await vite.ssrLoadModule('/src/libs/api.ts')

    await assert.rejects(logout(), (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 401)
      return true
    })
    assert.deepEqual(requests, [
      { url: 'http://localhost:9081/api/account/logout', method: 'POST' }
    ])
    assert.equal(tokenRemoveCount, 0)
    assert.equal(globalThis.window.location.href, '/')
  } finally {
    await vite.close()
    globalThis.fetch = originalFetch
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, 'localStorage', originalLocalStorage)
    } else {
      delete globalThis.localStorage
    }
    globalThis.window = originalWindow
  }
})
