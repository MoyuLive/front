import {
  buildFlvPlaybackUrl,
  buildHlsPlaybackUrl,
  buildWhepUrl,
  DEFAULT_PLAYBACK_PROTOCOLS,
  type PlaybackProtocol
} from '../../libs/streamUrls.js'

export interface BuildMoyuPlayerSourcesOptions {
  roomId: string
  token: string
  protocols: readonly PlaybackProtocol[]
  whepBaseUrl: string
}

export interface MoyuPlayerSource {
  protocol: PlaybackProtocol
  url: string
}

export function buildMoyuPlayerSources({
  roomId,
  token,
  protocols,
  whepBaseUrl
}: BuildMoyuPlayerSourcesOptions): MoyuPlayerSource[] {
  return protocols.map((protocol) => ({
    protocol,
    url: buildSourceUrl(protocol, roomId, token, whepBaseUrl)
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
  token: string,
  whepBaseUrl: string
) {
  switch (protocol) {
    case 'webrtc':
      return buildWhepUrl(whepBaseUrl, roomId, token)
    case 'hls':
      return buildHlsPlaybackUrl(roomId)
    case 'flv':
      return buildFlvPlaybackUrl(roomId)
  }
}
