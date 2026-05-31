import { buildRtmpPublishUrl, buildWhepUrl } from './streamUrls.js'

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
