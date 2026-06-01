import { atomWithStorage } from 'jotai/utils'

import type { PlaybackProtocol } from '../libs/streamUrls'

const storageOptions = { getOnInit: true }

export const playerVolumeAtom = atomWithStorage<number>(
  'playerVolume',
  0,
  undefined,
  storageOptions
)

export const preferredPlaybackProtocolAtom = atomWithStorage<PlaybackProtocol | null>(
  'preferredPlaybackProtocol',
  null,
  undefined,
  storageOptions
)
