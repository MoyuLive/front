import { atomWithStorage } from 'jotai/utils'

import type { PlaybackProtocol } from '../libs/streamUrls'

const storageOptions = { getOnInit: true }

export type DanmakuFontSize = 'small' | 'medium' | 'large'
export type DanmakuSpeed = 'slow' | 'normal' | 'fast'
export type DanmakuDensity = 'low' | 'normal' | 'high'
export type VideoFitMode = 'contain' | 'cover'

export interface DanmakuDisplaySettings {
  enabled: boolean
  fontSize: DanmakuFontSize
  opacity: number
  speed: DanmakuSpeed
  density: DanmakuDensity
}

export const defaultDanmakuDisplaySettings: DanmakuDisplaySettings = {
  enabled: true,
  fontSize: 'medium',
  opacity: 0.92,
  speed: 'normal',
  density: 'normal'
}

export const playerVolumeAtom = atomWithStorage<number>(
  'playerVolume',
  0,
  undefined,
  storageOptions
)

export const danmakuDisplaySettingsAtom = atomWithStorage<DanmakuDisplaySettings>(
  'danmakuDisplaySettings',
  defaultDanmakuDisplaySettings,
  undefined,
  storageOptions
)

export const danmakuPanelCollapsedAtom = atomWithStorage<boolean>(
  'danmakuPanelCollapsed',
  false,
  undefined,
  storageOptions
)

export const playerVideoFitModeAtom = atomWithStorage<VideoFitMode>(
  'playerVideoFitMode',
  'cover',
  undefined,
  storageOptions
)

export const preferredPlaybackProtocolAtom = atomWithStorage<PlaybackProtocol | null>(
  'preferredPlaybackProtocol',
  null,
  undefined,
  storageOptions
)
