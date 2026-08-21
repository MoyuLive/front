import { fullscreenEventNames, shouldShowPageFullscreenControl } from './fullscreenControls.ts'

function assertEqual(actual: boolean, expected: boolean, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`)
  }
}

function assertStringArrayEqual(actual: readonly string[], expected: readonly string[], message: string) {
  if (actual.join(',') !== expected.join(',')) {
    throw new Error(`${message}: expected ${expected.join(',')}, got ${actual.join(',')}`)
  }
}

assertEqual(
  shouldShowPageFullscreenControl(false),
  true,
  'page fullscreen control is visible outside native fullscreen'
)

assertEqual(
  shouldShowPageFullscreenControl(true),
  false,
  'page fullscreen control is hidden inside native fullscreen'
)

assertStringArrayEqual(
  fullscreenEventNames(),
  ['fullscreenchange', 'webkitfullscreenchange', 'MSFullscreenChange'],
  'fullscreen event names include standard and legacy browser events'
)
