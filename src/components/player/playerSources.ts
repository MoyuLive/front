import {
  buildFlvPlaybackUrl,
  buildHlsPlaybackUrl,
  buildWhepUrl,
  DEFAULT_PLAYBACK_PROTOCOLS,
  type PlaybackProtocol
} from '../../libs/streamUrls.js'

export interface BuildMoyuPlayerSourcesOptions {
  roomId: string
  ticket: string
  protocols: readonly PlaybackProtocol[]
  whepBaseUrl: string
}

export interface MoyuPlayerSource {
  protocol: PlaybackProtocol
  url: string
}

export function buildMoyuPlayerSources({
  roomId,
  ticket,
  protocols,
  whepBaseUrl
}: BuildMoyuPlayerSourcesOptions): MoyuPlayerSource[] {
  if (!roomId || !ticket) {
    return []
  }

  return protocols.map((protocol) => ({
    protocol,
    url: buildSourceUrl(protocol, roomId, ticket, whepBaseUrl)
  }))
}

export function pickInitialProtocol(
  protocols: readonly PlaybackProtocol[],
  current: PlaybackProtocol | undefined,
  preferred: PlaybackProtocol | null | undefined
): PlaybackProtocol | undefined {
  if (current && protocols.includes(current)) {
    return current
  }
  if (preferred && protocols.includes(preferred)) {
    return preferred
  }
  const [fallback] = DEFAULT_PLAYBACK_PROTOCOLS
  if (fallback && protocols.includes(fallback)) {
    return fallback
  }
  return protocols[0]
}

function buildSourceUrl(
  protocol: PlaybackProtocol,
  roomId: string,
  ticket: string,
  whepBaseUrl: string
) {
  switch (protocol) {
    case 'webrtc':
      return buildWhepUrl(whepBaseUrl, roomId, ticket)
    case 'hls':
      return buildHlsPlaybackUrl(roomId, ticket)
    case 'flv':
      return buildFlvPlaybackUrl(roomId, ticket)
  }
}
