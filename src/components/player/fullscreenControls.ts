export function shouldShowPageFullscreenControl(isNativeFullscreen: boolean): boolean {
  return !isNativeFullscreen
}

export function fullscreenEventNames(): readonly string[] {
  return ['fullscreenchange', 'webkitfullscreenchange', 'MSFullscreenChange']
}
