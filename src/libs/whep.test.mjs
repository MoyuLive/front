import assert from 'node:assert/strict'
import test from 'node:test'

import { WHEPClient } from './whep.js'

const OFFER_WITHOUT_CANDIDATE = [
  'v=0',
  'a=group:BUNDLE 0 1',
  'a=ice-ufrag:local-user',
  'a=ice-pwd:local-password',
  ''
].join('\r\n')

const OFFER_WITH_CANDIDATE = [
  'v=0',
  'a=group:BUNDLE 0 1',
  'a=ice-ufrag:local-user',
  'a=ice-pwd:local-password',
  'a=candidate:1 1 udp 1 127.0.0.1 50000 typ host',
  ''
].join('\r\n')

const ANSWER = [
  'v=0',
  'a=group:BUNDLE 0 1',
  'a=ice-ufrag:remote-user',
  'a=ice-pwd:remote-password',
  'a=candidate:0 1 udp 1 127.0.0.1 8000 typ host',
  ''
].join('\r\n')

class MockPeerConnection extends EventTarget {
  constructor({ completeOnSetLocalDescription = true, iceGatheringState = 'new' } = {}) {
    super()
    this.completeOnSetLocalDescription = completeOnSetLocalDescription
    this.iceGatheringState = iceGatheringState
    this.iceGatheringListeners = new Set()
    this.iceGatheringListenerAdded = new Promise((resolve) => {
      this.resolveIceGatheringListenerAdded = resolve
    })
    this.transceivers = [
      { mid: '0', receiver: { track: { kind: 'audio' } } },
      { mid: '1', receiver: { track: { kind: 'video' } } }
    ]
  }

  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options)
    if (type === 'icegatheringstatechange') {
      this.iceGatheringListeners.add(listener)
      this.resolveIceGatheringListenerAdded()
    }
  }

  removeEventListener(type, listener, options) {
    super.removeEventListener(type, listener, options)
    if (type === 'icegatheringstatechange') {
      this.iceGatheringListeners.delete(listener)
    }
  }

  async createOffer() {
    return { type: 'offer', sdp: OFFER_WITHOUT_CANDIDATE }
  }

  async setLocalDescription() {
    this.localDescription = { type: 'offer', sdp: OFFER_WITH_CANDIDATE }
    if (!this.completeOnSetLocalDescription) return

    this.iceGatheringState = 'complete'
    this.dispatchEvent(new Event('icegatheringstatechange'))
    this.onicecandidate?.({
      candidate: {
        candidate: 'candidate:1 1 udp 1 127.0.0.1 50000 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0'
      }
    })
    this.onicecandidate?.({ candidate: null })
  }

  async setRemoteDescription(description) {
    this.remoteDescription = description
  }

  getConfiguration() {
    return { iceServers: [] }
  }

  getTransceivers() {
    return this.transceivers
  }

  close() {}
}

test('WHEP rejects an already-aborted view before sending a request', { timeout: 1000 }, async () => {
  const originalFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), ...options })
    return {
      ok: true,
      status: 201,
      headers: new Headers({ location: '/rtc/v1/whip/?session=masked' }),
      text: async () => ANSWER
    }
  }

  try {
    const controller = new AbortController()
    controller.abort()
    const pc = new MockPeerConnection({ iceGatheringState: 'complete' })

    await assert.rejects(
      new WHEPClient().view(
        pc,
        'http://localhost/rtc/v1/whep/?app=live&stream=room',
        undefined,
        controller.signal
      ),
      { name: 'AbortError' }
    )
    assert.equal(requests.length, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('WHEP aborts while gathering ICE, removes its listener, and does not POST', { timeout: 1000 }, async () => {
  const originalFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), ...options })
    throw new Error('fetch must not run after abort')
  }

  try {
    const controller = new AbortController()
    const pc = new MockPeerConnection({ completeOnSetLocalDescription: false })
    const viewPromise = new WHEPClient().view(
      pc,
      'http://localhost/rtc/v1/whep/?app=live&stream=room',
      undefined,
      controller.signal
    )

    await pc.iceGatheringListenerAdded
    assert.equal(pc.iceGatheringListeners.size, 1)
    controller.abort()

    await assert.rejects(viewPromise, { name: 'AbortError' })
    assert.equal(pc.iceGatheringListeners.size, 0)
    assert.equal(requests.length, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('WHEP closes the abort race after registering its listeners', { timeout: 1000 }, async () => {
  const originalFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), ...options })
    throw new Error('fetch must not run after abort')
  }

  const abortListeners = new Set()
  const signal = {
    aborted: false,
    addEventListener(type, listener) {
      if (type !== 'abort') return
      abortListeners.add(listener)
      this.aborted = true
    },
    removeEventListener(type, listener) {
      if (type === 'abort') abortListeners.delete(listener)
    }
  }

  try {
    const pc = new MockPeerConnection({ completeOnSetLocalDescription: false })

    await assert.rejects(
      new WHEPClient().view(
        pc,
        'http://localhost/rtc/v1/whep/?app=live&stream=room',
        undefined,
        signal
      ),
      { name: 'AbortError' }
    )
    assert.equal(pc.iceGatheringListeners.size, 0)
    assert.equal(abortListeners.size, 0)
    assert.equal(requests.length, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('WHEP preserves the connection-state handler installed by the playback adapter', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true,
    status: 201,
    headers: new Headers({ location: '/rtc/v1/whip/?session=masked' }),
    text: async () => ANSWER
  })

  try {
    const pc = new MockPeerConnection()
    const onConnectionStateChange = () => {}
    pc.onconnectionstatechange = onConnectionStateChange

    await new WHEPClient().view(
      pc,
      'http://localhost/rtc/v1/whep/?app=live&stream=room',
      undefined
    )

    assert.equal(pc.onconnectionstatechange, onConnectionStateChange)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('WHEP sends the gathered offer in one POST without incompatible trickle PATCH', async () => {
  const originalFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), ...options })
    if (options.method === 'PATCH') {
      return { ok: true, status: 204, headers: new Headers(), text: async () => '' }
    }
    return {
      ok: true,
      status: 201,
      headers: new Headers({ location: '/rtc/v1/whip/?session=masked' }),
      text: async () => ANSWER
    }
  }

  try {
    const pc = new MockPeerConnection()
    await new WHEPClient().view(pc, 'http://localhost/rtc/v1/whep/?app=live&stream=room', undefined)
    await new Promise((resolve) => setTimeout(resolve, 10))

    assert.equal(requests.length, 1)
    assert.equal(requests[0].method, 'POST')
    assert.match(requests[0].body, /a=candidate:/)
    assert.equal(requests[0].headers.Authorization, undefined)
    assert.equal(pc.remoteDescription.sdp, ANSWER)
  } finally {
    globalThis.fetch = originalFetch
  }
})
