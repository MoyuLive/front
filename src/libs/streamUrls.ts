export const DEFAULT_WHEP_BASE = 'http://localhost:1985'
export const DEFAULT_RTMP_HOST = 'localhost:1935'
export const SUPPORTED_PLAYBACK_PROTOCOLS = ['webrtc', 'hls', 'flv'] as const
export const DEFAULT_PLAYBACK_PROTOCOLS: PlaybackProtocol[] = ['webrtc']

export type PlaybackProtocol = typeof SUPPORTED_PLAYBACK_PROTOCOLS[number]

export function normalizePlaybackProtocols(protocols: readonly string[]): PlaybackProtocol[] {
  const normalized = protocols.reduce<PlaybackProtocol[]>((acc, protocol) => {
    const value = protocol.trim().toLowerCase() as PlaybackProtocol
    if (SUPPORTED_PLAYBACK_PROTOCOLS.includes(value) && !acc.includes(value)) {
      acc.push(value)
    }
    return acc
  }, [])

  return normalized.length > 0 ? normalized : DEFAULT_PLAYBACK_PROTOCOLS
}

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
