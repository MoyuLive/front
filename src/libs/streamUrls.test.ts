import {
  AVAILABLE_PLAYBACK_PROTOCOLS,
  buildFlvPlaybackUrl,
  buildHlsPlaybackUrl,
  buildRtmpPublishUrl,
  buildWhepUrl
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
  AVAILABLE_PLAYBACK_PROTOCOLS.join(','),
  'webrtc,hls,flv'
)
