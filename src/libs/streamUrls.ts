export const DEFAULT_WHEP_BASE = 'http://localhost:1985'
export const DEFAULT_RTMP_HOST = 'localhost:1935'
export const AVAILABLE_PLAYBACK_PROTOCOLS = ['webrtc', 'hls', 'flv'] as const

export type PlaybackProtocol = typeof AVAILABLE_PLAYBACK_PROTOCOLS[number]

export function buildWhepUrl(baseUrl: string, roomId: string, token: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  const url = new URL(`${normalizedBase}/rtc/v1/whep/`)
  url.searchParams.set('app', 'live')
  url.searchParams.set('stream', roomId)
  url.searchParams.set('token', token)
  return url.toString()
}

export function buildRtmpPublishUrl(host: string, streamName: string, token: string) {
  return `rtmp://${host}/live/${streamName}?token=${encodeURIComponent(token)}`
}

export function buildHlsPlaybackUrl(roomId: string) {
  return `/live/${encodeURIComponent(roomId)}.m3u8`
}

export function buildFlvPlaybackUrl(roomId: string) {
  return `/live/${encodeURIComponent(roomId)}.flv`
}
