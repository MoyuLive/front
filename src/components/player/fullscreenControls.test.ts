import { shouldShowPageFullscreenControl } from './fullscreenControls.ts'

function assertEqual(actual: boolean, expected: boolean, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`)
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
