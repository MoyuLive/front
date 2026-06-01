import { WHEPClient } from '../../libs/whep'

import type { MoyuPlayerSource } from './playerSources'

declare global {
  interface Window {
    pc?: RTCPeerConnection
    whepClient?: WHEPClient
  }
}

export interface PlaybackAdapterOptions {
  video: HTMLVideoElement
  source: MoyuPlayerSource
  token: string
  iceServers: RTCIceServer[]
  onReady: () => void
  onError: (error: Error) => void
}

export interface PlaybackHandle {
  destroy: () => void | Promise<void>
}

export async function attachPlaybackSource({
  video,
  source,
  token,
  iceServers,
  onReady,
  onError
}: PlaybackAdapterOptions): Promise<PlaybackHandle> {
  resetVideo(video)

  switch (source.protocol) {
    case 'webrtc':
      return attachWebRtc(video, source.url, token, iceServers, onReady, onError)
    case 'hls':
      return attachHls(video, source.url, onReady, onError)
    case 'flv':
      return attachFlv(video, source.url, onReady, onError)
  }
}

function resetVideo(video: HTMLVideoElement) {
  video.pause()
  video.removeAttribute('src')
  video.srcObject = null
  video.load()
}

async function attachWebRtc(
  video: HTMLVideoElement,
  url: string,
  token: string,
  iceServers: RTCIceServer[],
  onReady: () => void,
  onError: (error: Error) => void
): Promise<PlaybackHandle> {
  const pc = new RTCPeerConnection({ iceServers })
  const whep = new WHEPClient()
  const abortController = new AbortController()
  let attached = false
  let destroyed = false

  window.pc = pc
  window.whepClient = whep

  pc.addTransceiver('audio', { direction: 'recvonly' })
  pc.addTransceiver('video', { direction: 'recvonly' })

  pc.ontrack = (event) => {
    const [stream] = event.streams
    if (!attached && stream) {
      attached = true
      video.srcObject = stream
      onReady()
    }
  }

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') {
      onError(new Error('WebRTC connection failed'))
    }
  }

  whep.view(pc, url, token, abortController.signal).catch((error: Error) => {
    if (!destroyed) {
      onError(error)
    }
  })

  return {
    async destroy() {
      destroyed = true
      abortController.abort()
      try {
        await whep.stop()
      } catch {
        // Best-effort cleanup; the connection may already be closed.
      }
      pc.close()
      if (window.pc === pc) {
        window.pc = undefined
      }
      if (window.whepClient === whep) {
        window.whepClient = undefined
      }
    }
  }
}

async function attachHls(
  video: HTMLVideoElement,
  url: string,
  onReady: () => void,
  onError: (error: Error) => void
): Promise<PlaybackHandle> {
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url
    video.load()
    onReady()
    return {
      destroy() {
        resetVideo(video)
      }
    }
  }

  const { default: Hls } = await import('hls.js')
  if (!Hls.isSupported()) {
    throw new Error('HLS is not supported by this browser')
  }

  const hls = new Hls({
    lowLatencyMode: true,
    liveSyncDurationCount: 3
  })

  hls.on(Hls.Events.MANIFEST_PARSED, () => onReady())
  hls.on(Hls.Events.ERROR, (_, data) => {
    if (data.fatal) {
      onError(new Error(`HLS playback failed: ${data.type}`))
    }
  })
  hls.loadSource(url)
  hls.attachMedia(video)

  return {
    destroy() {
      hls.destroy()
      resetVideo(video)
    }
  }
}

async function attachFlv(
  video: HTMLVideoElement,
  url: string,
  onReady: () => void,
  onError: (error: Error) => void
): Promise<PlaybackHandle> {
  const { default: flvjs } = await import('flv.js')
  if (!flvjs.isSupported()) {
    throw new Error('FLV is not supported by this browser')
  }

  const player = flvjs.createPlayer(
    { type: 'flv', isLive: true, url },
    {
      enableStashBuffer: false,
      autoCleanupSourceBuffer: true,
      autoCleanupMaxBackwardDuration: 30,
      autoCleanupMinBackwardDuration: 10
    }
  )

  player.on(flvjs.Events.ERROR, (_type: string, detail: string) => {
    onError(new Error(`FLV playback failed: ${detail}`))
  })
  player.attachMediaElement(video)
  player.load()
  onReady()

  return {
    destroy() {
      try {
        player.unload()
        player.detachMediaElement()
        player.destroy()
      } finally {
        resetVideo(video)
      }
    }
  }
}
