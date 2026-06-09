export const DEFAULT_WHEP_BASE = 'http://localhost:1985'
export const DEFAULT_WHIP_BASE = 'http://localhost:1985'
export const DEFAULT_RTMP_HOST = 'localhost:1935'
export const DEFAULT_SRT_HOST = 'localhost:10080'
export const SUPPORTED_PLAYBACK_PROTOCOLS = ['webrtc', 'hls', 'flv'] as const
export const DEFAULT_PLAYBACK_PROTOCOLS: PlaybackProtocol[] = ['flv']
export const SUPPORTED_PUBLISH_PROTOCOLS = ['rtmp', 'whip', 'srt'] as const
export const DEFAULT_PUBLISH_PROTOCOLS: PublishProtocol[] = ['rtmp']

export type PlaybackProtocol = typeof SUPPORTED_PLAYBACK_PROTOCOLS[number]
export type PublishProtocol = typeof SUPPORTED_PUBLISH_PROTOCOLS[number]

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

export function normalizePublishProtocols(protocols: readonly string[]): PublishProtocol[] {
  const normalized = protocols.reduce<PublishProtocol[]>((acc, protocol) => {
    const value = protocol.trim().toLowerCase() as PublishProtocol
    if (SUPPORTED_PUBLISH_PROTOCOLS.includes(value) && !acc.includes(value)) {
      acc.push(value)
    }
    return acc
  }, [])

  return normalized.length > 0 ? normalized : DEFAULT_PUBLISH_PROTOCOLS
}

function stripScheme(hostOrUrl: string): string {
  return hostOrUrl.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '')
}

export function buildWhepUrl(baseUrl: string, roomId: string, token: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  const url = new URL(`${normalizedBase}/rtc/v1/whep/`)
  url.searchParams.set('app', 'live')
  url.searchParams.set('stream', roomId)
  url.searchParams.set('token', token)
  return url.toString()
}

export function buildWhipPublishUrl(baseUrl: string, streamName: string, token: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  const url = new URL(`${normalizedBase}/rtc/v1/whip/`)
  url.searchParams.set('app', 'live')
  url.searchParams.set('stream', streamName)
  url.searchParams.set('token', token)
  return url.toString()
}

export function buildRtmpServerUrl(host: string) {
  return `rtmp://${stripScheme(host)}`
}

export function buildRtmpStreamKey(streamName: string, token: string) {
  return `live/${streamName}?token=${encodeURIComponent(token)}`
}

export function buildRtmpPublishUrl(host: string, streamName: string, token: string) {
  return `${buildRtmpServerUrl(host)}/${buildRtmpStreamKey(streamName, token)}`
}

export function buildSrtPublishUrl(host: string, streamName: string, token: string) {
  const streamId = buildSrtStreamId(streamName, token)
  const url = new URL(`srt://${stripScheme(host)}`)
  url.searchParams.set('streamid', streamId)
  return url.toString()
}

export function buildSrtStreamId(streamName: string, token: string) {
  return `#!::r=live/${streamName},m=publish,token=${token}`
}

export function buildHlsPlaybackUrl(roomId: string) {
  return `/live/${encodeURIComponent(roomId)}.m3u8`
}

export function buildFlvPlaybackUrl(roomId: string) {
  return `/live/${encodeURIComponent(roomId)}.flv`
}
