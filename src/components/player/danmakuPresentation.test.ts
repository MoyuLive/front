import type { DanmakuDisplaySettings } from '../../storages/player.ts'

import {
  getDanmakuStyle,
  getDanmakuVisibleLimit,
  normalizeDanmakuDisplaySettings
} from './danmakuPresentation.ts'

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`)
  }
}

const baseSettings: DanmakuDisplaySettings = {
  enabled: true,
  fontSize: 'medium',
  opacity: 0.92,
  speed: 'normal',
  density: 'normal'
}

assertEqual(
  getDanmakuVisibleLimit({ ...baseSettings, density: 'low' }),
  12,
  'low density visible limit'
)
assertEqual(
  getDanmakuVisibleLimit({ ...baseSettings, density: 'normal' }),
  24,
  'normal density visible limit'
)
assertEqual(
  getDanmakuVisibleLimit({ ...baseSettings, density: 'high' }),
  36,
  'high density visible limit'
)

assertEqual(
  normalizeDanmakuDisplaySettings({ ...baseSettings, opacity: 0.1 }).opacity,
  0.35,
  'opacity clamps to lower bound'
)
assertEqual(
  normalizeDanmakuDisplaySettings({ ...baseSettings, opacity: 1.4 }).opacity,
  1,
  'opacity clamps to upper bound'
)

const style = getDanmakuStyle(
  { ...baseSettings, density: 'normal', fontSize: 'large', opacity: 0.5, speed: 'fast' },
  'message-1'
)

assertEqual(style['--danmaku-duration'], '7s', 'speed maps to duration CSS variable')
assertEqual(style['--danmaku-font-size'], '1.125rem', 'font size maps to CSS variable')
assertEqual(style['--danmaku-opacity'], '0.5', 'opacity maps to CSS variable')
assertEqual(style['--danmaku-offset'], '136px', 'desktop track offset is deterministic')
assertEqual(style['--danmaku-offset-mobile'], '52px', 'mobile track offset is deterministic')

const clampedStyle = getDanmakuStyle({ ...baseSettings, opacity: 2 }, 'message-1')
assertEqual(clampedStyle['--danmaku-opacity'], '1', 'style uses normalized opacity')
