import type { CSSProperties } from 'react'

import {
  defaultDanmakuDisplaySettings,
  type DanmakuDensity,
  type DanmakuDisplaySettings,
  type DanmakuFontSize,
  type DanmakuSpeed
} from '../../storages/player.ts'

const VISIBLE_LIMIT_BY_DENSITY: Record<DanmakuDensity, number> = {
  low: 12,
  normal: 24,
  high: 36
}

const DESKTOP_TRACKS_BY_DENSITY: Record<DanmakuDensity, number> = {
  low: 3,
  normal: 6,
  high: 8
}

const MOBILE_TRACKS_BY_DENSITY: Record<DanmakuDensity, number> = {
  low: 2,
  normal: 4,
  high: 5
}

const FONT_SIZE_BY_SETTING: Record<DanmakuFontSize, string> = {
  small: '0.875rem',
  medium: '1rem',
  large: '1.125rem'
}

const DURATION_BY_SPEED: Record<DanmakuSpeed, string> = {
  slow: '12s',
  normal: '10s',
  fast: '7s'
}

export interface DanmakuMessageStyle extends CSSProperties {
  '--danmaku-duration': string
  '--danmaku-offset': string
  '--danmaku-offset-mobile': string
  '--danmaku-font-size': string
  '--danmaku-opacity': string
}

function isDanmakuFontSize(value: unknown): value is DanmakuFontSize {
  return typeof value === 'string' && Object.hasOwn(FONT_SIZE_BY_SETTING, value)
}

function isDanmakuSpeed(value: unknown): value is DanmakuSpeed {
  return typeof value === 'string' && Object.hasOwn(DURATION_BY_SPEED, value)
}

function isDanmakuDensity(value: unknown): value is DanmakuDensity {
  return typeof value === 'string' && Object.hasOwn(VISIBLE_LIMIT_BY_DENSITY, value)
}

function clampOpacity(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return defaultDanmakuDisplaySettings.opacity
  }

  return Math.min(1, Math.max(0.35, value))
}

function hashMessageId(id: string) {
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function normalizeDanmakuDisplaySettings(
  value: DanmakuDisplaySettings
): DanmakuDisplaySettings {
  const candidate = value as Partial<DanmakuDisplaySettings> | null | undefined

  return {
    enabled:
      typeof candidate?.enabled === 'boolean'
        ? candidate.enabled
        : defaultDanmakuDisplaySettings.enabled,
    fontSize: isDanmakuFontSize(candidate?.fontSize)
      ? candidate.fontSize
      : defaultDanmakuDisplaySettings.fontSize,
    opacity: clampOpacity(candidate?.opacity),
    speed: isDanmakuSpeed(candidate?.speed) ? candidate.speed : defaultDanmakuDisplaySettings.speed,
    density: isDanmakuDensity(candidate?.density)
      ? candidate.density
      : defaultDanmakuDisplaySettings.density
  }
}

export function getDanmakuVisibleLimit(settings: DanmakuDisplaySettings) {
  return VISIBLE_LIMIT_BY_DENSITY[normalizeDanmakuDisplaySettings(settings).density]
}

export function getDanmakuStyle(
  settings: DanmakuDisplaySettings,
  messageId: string
): DanmakuMessageStyle {
  const normalizedSettings = normalizeDanmakuDisplaySettings(settings)
  const hash = hashMessageId(messageId)
  const desktopTrack = hash % DESKTOP_TRACKS_BY_DENSITY[normalizedSettings.density]
  const mobileTrack = hash % MOBILE_TRACKS_BY_DENSITY[normalizedSettings.density]

  return {
    '--danmaku-duration': DURATION_BY_SPEED[normalizedSettings.speed],
    '--danmaku-offset': `${8 + desktopTrack * 32}px`,
    '--danmaku-offset-mobile': `${4 + mobileTrack * 24}px`,
    '--danmaku-font-size': FONT_SIZE_BY_SETTING[normalizedSettings.fontSize],
    '--danmaku-opacity': String(normalizedSettings.opacity)
  }
}
