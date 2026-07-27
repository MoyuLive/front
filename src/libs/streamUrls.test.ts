import {
  buildFlvPlaybackUrl,
  buildHlsPlaybackUrl,
  buildRtmpPublishUrl,
  buildRtmpServerUrl,
  buildRtmpStreamKey,
  buildRoomWebSocketUrl,
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
} from './streamUrls.ts'

function assertEqual(actual: string, expected: string) {
  if (actual !== expected) {
    throw new Error(`expected ${expected}, got ${actual}`)
  }
}

function assertPlaybackTicketUrl(actual: string, expected: string, ticket: string) {
  assertEqual(actual, expected)
  const url = new URL(actual, 'https://viewer.example')
  assertEqual(String(url.searchParams.getAll('ticket').length), '1')
  assertEqual(url.searchParams.get('ticket') ?? '', ticket)
  assertEqual(String(url.searchParams.has('token')), 'false')
}

const reservedCharacterTicket = '+/=?&'

assertPlaybackTicketUrl(
  buildWhepUrl('https://live.example', 'room-1', reservedCharacterTicket),
  'https://live.example/rtc/v1/whep/?app=live&stream=room-1&ticket=%2B%2F%3D%3F%26',
  reservedCharacterTicket
)

assertPlaybackTicketUrl(
  buildHlsPlaybackUrl('room-1', reservedCharacterTicket),
  '/live/room-1.m3u8?ticket=%2B%2F%3D%3F%26',
  reservedCharacterTicket
)

assertPlaybackTicketUrl(
  buildFlvPlaybackUrl('room-1', reservedCharacterTicket),
  '/live/room-1.flv?ticket=%2B%2F%3D%3F%26',
  reservedCharacterTicket
)

assertEqual(
  buildWhepUrl('https://live.example', 'room-1', 'a+b/c='),
  'https://live.example/rtc/v1/whep/?app=live&stream=room-1&ticket=a%2Bb%2Fc%3D'
)

assertEqual(
  buildHlsPlaybackUrl('room-1', 'a+b/c='),
  '/live/room-1.m3u8?ticket=a%2Bb%2Fc%3D'
)

assertEqual(
  buildFlvPlaybackUrl('room-1', 'a+b/c='),
  '/live/room-1.flv?ticket=a%2Bb%2Fc%3D'
)

assertEqual(
  buildRoomWebSocketUrl('https://live.example', 'room-1', 'a+b/c='),
  'wss://live.example/api/live/rooms/room-1/ws?ticket=a%2Bb%2Fc%3D'
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
  buildHlsPlaybackUrl('room 1', 'ticket'),
  '/live/room%201.m3u8?ticket=ticket'
)

assertEqual(
  buildFlvPlaybackUrl('room 1', 'ticket'),
  '/live/room%201.flv?ticket=ticket'
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
