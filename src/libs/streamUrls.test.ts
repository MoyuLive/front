import {
  buildFlvPlaybackUrl,
  buildHlsPlaybackUrl,
  buildRtmpPublishUrl,
  buildRtmpServerUrl,
  buildRtmpStreamKey,
  buildSrtPublishUrl,
  buildSrtStreamId,
  buildWhipPublishUrl,
  buildWhepUrl,
  DEFAULT_PLAYBACK_PROTOCOLS,
  DEFAULT_PUBLISH_PROTOCOLS,
  normalizePlaybackProtocols,
  normalizePublishProtocols,
  SUPPORTED_PUBLISH_PROTOCOLS,
  SUPPORTED_PLAYBACK_PROTOCOLS
} from './streamUrls.js'

function assertEqual(actual: string, expected: string) {
  if (actual !== expected) {
    throw new Error(`expected ${expected}, got ${actual}`)
  }
}

assertEqual(
  buildWhepUrl('https://live.example.com/srs', 'room-1', 'jwt-token'),
  'https://live.example.com/srs/rtc/v1/whep/?app=live&stream=room-1&token=jwt-token'
)

assertEqual(
  buildRtmpPublishUrl('live.example.com:1935', 'STREAM', 'stream-token'),
  'rtmp://live.example.com:1935/live/STREAM?token=stream-token'
)

assertEqual(
  buildRtmpPublishUrl('rtmp://live.example.com:1935', 'STREAM', 'stream token'),
  'rtmp://live.example.com:1935/live/STREAM?token=stream%20token'
)

assertEqual(
  buildRtmpServerUrl('rtmp://live.example.com:1935/'),
  'rtmp://live.example.com:1935'
)

assertEqual(
  buildRtmpStreamKey('STREAM', 'stream token'),
  'live/STREAM?token=stream%20token'
)

assertEqual(
  buildWhipPublishUrl('https://live.example.com/srs', 'room-1', 'jwt-token'),
  'https://live.example.com/srs/rtc/v1/whip/?app=live&stream=room-1&token=jwt-token'
)

assertEqual(
  buildSrtPublishUrl('live.example.com:10080', 'room-1', 'jwt-token'),
  'srt://live.example.com:10080/?streamid=%23%21%3A%3Ar%3Dlive%2Froom-1%2Cm%3Dpublish%2Ctoken%3Djwt-token'
)

assertEqual(
  buildSrtStreamId('room-1', 'jwt-token'),
  '#!::r=live/room-1,m=publish,token=jwt-token'
)

assertEqual(
  buildHlsPlaybackUrl('room-1'),
  '/live/room-1.m3u8'
)

assertEqual(
  buildHlsPlaybackUrl('room 1'),
  '/live/room%201.m3u8'
)

assertEqual(
  buildFlvPlaybackUrl('room-1'),
  '/live/room-1.flv'
)

assertEqual(
  buildFlvPlaybackUrl('room 1'),
  '/live/room%201.flv'
)

assertEqual(
  SUPPORTED_PLAYBACK_PROTOCOLS.join(','),
  'webrtc,hls,flv'
)

assertEqual(
  DEFAULT_PLAYBACK_PROTOCOLS.join(','),
  'flv'
)

assertEqual(
  SUPPORTED_PUBLISH_PROTOCOLS.join(','),
  'rtmp,whip,srt'
)

assertEqual(
  DEFAULT_PUBLISH_PROTOCOLS.join(','),
  'rtmp'
)

assertEqual(
  normalizePlaybackProtocols(['flv', 'unknown', 'hls', 'flv']).join(','),
  'flv,hls'
)

assertEqual(
  normalizePlaybackProtocols([]).join(','),
  'flv'
)

assertEqual(
  normalizePublishProtocols(['srt', 'unknown', 'whip', 'srt']).join(','),
  'srt,whip'
)

assertEqual(
  normalizePublishProtocols([]).join(','),
  'rtmp'
)
