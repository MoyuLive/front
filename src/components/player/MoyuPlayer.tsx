import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  IconButton,
  Menu,
  MenuItem,
  Slider,
  Tooltip
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import AspectRatioIcon from '@mui/icons-material/AspectRatio'
import FitScreenIcon from '@mui/icons-material/FitScreen'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import PauseIcon from '@mui/icons-material/Pause'
import PictureInPictureAltIcon from '@mui/icons-material/PictureInPictureAlt'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import { useHotkeys } from 'react-hotkeys-hook'
import { useAtom } from 'jotai'

import { getPlaybackProtocols, type DanmakuMessage } from '../../libs/api'
import {
  DEFAULT_PLAYBACK_PROTOCOLS,
  DEFAULT_WHEP_BASE,
  normalizePlaybackProtocols,
  type PlaybackProtocol
} from '../../libs/streamUrls'
import {
  defaultDanmakuDisplaySettings,
  playerVideoFitModeAtom,
  playerVolumeAtom,
  preferredPlaybackProtocolAtom,
  type DanmakuDisplaySettings,
  type VideoFitMode
} from '../../storages/player'

import styles from './MoyuPlayer.module.scss'
import DanmakuOverlay from './DanmakuOverlay'
import { attachPlaybackSource, type PlaybackHandle } from './playbackAdapters'
import { fullscreenEventNames, shouldShowPageFullscreenControl } from './fullscreenControls'
import {
  buildMoyuPlayerSources,
  pickInitialProtocol
} from './playerSources'

const whepBaseURL = import.meta.env.VITE_WHEP_BASE || DEFAULT_WHEP_BASE

interface PlayerCssVariables extends CSSProperties {
  '--player-overlay-outline': string
  '--player-overlay-surface': string
  '--player-overlay-text': string
}

function areProtocolsEqual(left: readonly PlaybackProtocol[], right: readonly PlaybackProtocol[]) {
  return left.length === right.length && left.every((protocol, index) => protocol === right[index])
}

type FullscreenDocument = Document & {
  fullscreenEnabled?: boolean
  fullscreenElement?: Element | null
  exitFullscreen?: () => Promise<void>
  msExitFullscreen?: () => void
  msFullscreenElement?: Element | null
  webkitExitFullscreen?: () => void
  webkitFullscreenElement?: Element | null
  webkitFullscreenEnabled?: boolean
}

type FullscreenPlayerElement = HTMLDivElement & {
  webkitRequestFullscreen?: () => void
}

type FullscreenVideoElement = HTMLVideoElement & {
  webkitDisplayingFullscreen?: boolean
  webkitEnterFullscreen?: () => void
  webkitExitFullscreen?: () => void
  webkitSupportsFullscreen?: boolean
}

type PictureInPictureMode = 'inline' | 'picture-in-picture' | 'fullscreen'

type PictureInPictureDocument = Document & {
  pictureInPictureEnabled?: boolean
  pictureInPictureElement?: Element | null
  exitPictureInPicture?: () => Promise<void>
}

type PictureInPictureVideoElement = HTMLVideoElement & {
  requestPictureInPicture?: () => Promise<unknown>
  webkitPresentationMode?: PictureInPictureMode
  webkitSetPresentationMode?: (mode: PictureInPictureMode) => void
  webkitSupportsPresentationMode?: (mode: PictureInPictureMode) => boolean
}

function getIceServers(): RTCIceServer[] {
  const raw = import.meta.env.VITE_ICE_SERVERS
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {
      console.warn('Failed to parse VITE_ICE_SERVERS, using default STUN')
    }
  }
  return [{ urls: 'stun:stun.l.google.com:19302' }]
}

function canUseNativeFullscreen(player: HTMLDivElement, video: HTMLVideoElement) {
  const fullscreenDocument = document as FullscreenDocument
  const fullscreenPlayer = player as FullscreenPlayerElement
  const fullscreenVideo = video as FullscreenVideoElement
  const standardFullscreen = fullscreenDocument.fullscreenEnabled === true &&
    Boolean(player.requestFullscreen)
  const webkitElementFullscreen = fullscreenDocument.webkitFullscreenEnabled === true &&
    Boolean(fullscreenPlayer.webkitRequestFullscreen)
  const webkitFullscreen = Boolean(fullscreenVideo.webkitEnterFullscreen)
  return standardFullscreen || webkitElementFullscreen || webkitFullscreen
}

function isNativeFullscreenActive(player: HTMLDivElement, video: HTMLVideoElement) {
  const fullscreenDocument = document as FullscreenDocument
  const fullscreenVideo = video as FullscreenVideoElement
  const fullscreenElement = fullscreenDocument.fullscreenElement ||
    fullscreenDocument.webkitFullscreenElement ||
    fullscreenDocument.msFullscreenElement
  return fullscreenElement === player ||
    Boolean(fullscreenElement && player.contains(fullscreenElement)) ||
    (fullscreenVideo.webkitDisplayingFullscreen === true &&
      typeof fullscreenVideo.webkitExitFullscreen === 'function')
}

function canUsePictureInPicture(video: HTMLVideoElement) {
  const pipDocument = document as PictureInPictureDocument
  const pipVideo = video as PictureInPictureVideoElement
  const standardPip = pipDocument.pictureInPictureEnabled !== false &&
    Boolean(pipVideo.requestPictureInPicture)
  const webkitPip = Boolean(pipVideo.webkitSupportsPresentationMode?.('picture-in-picture'))
  return standardPip || webkitPip
}

function isPictureInPictureActive(video: HTMLVideoElement) {
  const pipDocument = document as PictureInPictureDocument
  const pipVideo = video as PictureInPictureVideoElement
  return pipDocument.pictureInPictureElement === video || pipVideo.webkitPresentationMode === 'picture-in-picture'
}

function warnControlFailure(action: string, err?: unknown) {
  console.warn(`${action} failed`, err)
}

function clearVideoElement(video: HTMLVideoElement) {
  video.pause()
  video.removeAttribute('src')
  video.srcObject = null
  video.load()
}

function isPlaybackGestureError(err: unknown) {
  if (!(err instanceof Error)) return false
  return err.name === 'NotAllowedError' ||
    err.message.toLowerCase().includes('user didn\'t interact')
}

export interface MoyuPlayerProps {
  roomId: string
  ticket: string
  danmakuMessages?: readonly DanmakuMessage[]
  danmakuSettings?: DanmakuDisplaySettings
  onVideoElementChange?: (video: HTMLVideoElement | null) => void
}

function MoyuPlayer({
  roomId,
  ticket,
  danmakuMessages = [],
  danmakuSettings = defaultDanmakuDisplaySettings,
  onVideoElementChange
}: MoyuPlayerProps) {
  const theme = useTheme()
  const playerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playbackRef = useRef<PlaybackHandle>()
  const isPlayingRef = useRef(true)
  const isSwitchingSourceRef = useRef(false)
  const volumeRef = useRef(0)
  const [volume, setVolume] = useAtom(playerVolumeAtom)
  const [preferredProtocol, setPreferredProtocol] = useAtom(preferredPlaybackProtocolAtom)
  const [videoFitMode, setVideoFitMode] = useAtom(playerVideoFitModeAtom)
  const preferredProtocolRef = useRef(preferredProtocol)
  const [protocols, setProtocols] = useState<PlaybackProtocol[]>([])
  const [protocol, setProtocol] = useState<PlaybackProtocol>()
  const [isPlaying, setIsPlaying] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [playbackNeedsGesture, setPlaybackNeedsGesture] = useState(false)
  const [isWebFullscreen, setIsWebFullscreen] = useState(false)
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false)
  const [isPictureInPicture, setIsPictureInPicture] = useState(false)
  const [nativeFullscreenSupported, setNativeFullscreenSupported] = useState(false)
  const [pictureInPictureSupported, setPictureInPictureSupported] = useState(false)
  const [error, setError] = useState<string>()
  const [protocolMenuAnchor, setProtocolMenuAnchor] = useState<null | HTMLElement>(null)
  const hasPlaybackAccess = Boolean(roomId && ticket)
  const playerCssVariables = useMemo<PlayerCssVariables>(() => ({
    '--player-overlay-outline': theme.palette.common.black,
    '--player-overlay-surface': alpha(theme.palette.common.black, 0.68),
    '--player-overlay-text': theme.palette.common.white
  }), [theme])

  const sources = useMemo(
    () => buildMoyuPlayerSources({
      roomId,
      ticket,
      protocols,
      whepBaseUrl: whepBaseURL
    }),
    [protocols, roomId, ticket]
  )
  const currentSource = sources.find((source) => source.protocol === protocol)
  const isMuted = volume <= 0

  useEffect(() => {
    onVideoElementChange?.(videoRef.current)
    return () => onVideoElementChange?.(null)
  }, [onVideoElementChange])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    volumeRef.current = volume
  }, [volume])

  const setPlaybackVolume = useCallback((value: number | ((current: number) => number)) => {
    const nextVolume = typeof value === 'function' ? value(volumeRef.current) : value
    volumeRef.current = nextVolume

    const video = videoRef.current
    if (video) {
      video.volume = nextVolume
      video.muted = nextVolume <= 0
    }

    setVolume(nextVolume)
  }, [setVolume])

  const playVideo = useCallback(async (video: HTMLVideoElement, userInitiated: boolean) => {
    try {
      video.muted = volumeRef.current <= 0
      video.volume = volumeRef.current
      await video.play()
      setPlaybackNeedsGesture(false)
      setError(undefined)
      setIsPlaying(true)
    } catch (err) {
      video.pause()
      setIsPlaying(false)
      if (userInitiated && !isPlaybackGestureError(err)) {
        setError(err instanceof Error ? err.message : 'Playback failed')
      } else {
        setPlaybackNeedsGesture(true)
      }
    }
  }, [])

  useEffect(() => {
    preferredProtocolRef.current = preferredProtocol
  }, [preferredProtocol])

  useEffect(() => {
    let cancelled = false

    getPlaybackProtocols()
      .then((data) => normalizePlaybackProtocols(data.protocols))
      .catch((err) => {
        console.warn('Failed to load playback protocols, using default', err)
        return DEFAULT_PLAYBACK_PROTOCOLS
      })
      .then((nextProtocols) => {
        if (cancelled) return
        setProtocols((current) => (
          areProtocolsEqual(current, nextProtocols) ? current : nextProtocols
        ))
        setProtocol((current) => (
          pickInitialProtocol(nextProtocols, current, preferredProtocolRef.current)
        ))
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    if (!currentSource || !roomId || !ticket) {
      isSwitchingSourceRef.current = false
      setPlaybackNeedsGesture(false)
      setIsReady(false)
      setError(undefined)
      clearVideoElement(video)
      return
    }

    let cancelled = false
    isSwitchingSourceRef.current = true
    setPlaybackNeedsGesture(false)
    setIsReady(false)
    setError(undefined)
    playbackRef.current?.destroy()
    playbackRef.current = undefined

    attachPlaybackSource({
      video,
      source: currentSource,
      iceServers: getIceServers(),
      onReady: () => {
        if (cancelled) return
        isSwitchingSourceRef.current = false
        setIsReady(true)
        if (isPlayingRef.current) {
          void playVideo(video, false)
        }
      },
      onError: (err) => {
        if (cancelled) return
        isSwitchingSourceRef.current = false
        setError(err.message)
      }
    })
      .then((handle) => {
        if (cancelled) {
          void handle.destroy()
        } else {
          playbackRef.current = handle
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          isSwitchingSourceRef.current = false
          setError(err.message)
        }
      })

    return () => {
      cancelled = true
      isSwitchingSourceRef.current = true
      const handle = playbackRef.current
      playbackRef.current = undefined
      void handle?.destroy()
    }
  }, [currentSource, roomId, playVideo, ticket])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = volume
  }, [volume])

  useEffect(() => {
    if (!isWebFullscreen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isWebFullscreen])

  useEffect(() => {
    const player = playerRef.current
    const video = videoRef.current
    if (!player || !video) return
    const playerElement = player
    const videoElement = video

    function syncNativeFullscreen() {
      setIsNativeFullscreen(isNativeFullscreenActive(playerElement, videoElement))
    }

    setNativeFullscreenSupported(canUseNativeFullscreen(playerElement, videoElement))
    syncNativeFullscreen()

    const nativeFullscreenEvents = fullscreenEventNames()
    nativeFullscreenEvents.forEach((eventName) => {
      document.addEventListener(eventName, syncNativeFullscreen)
    })
    videoElement.addEventListener('webkitbeginfullscreen', syncNativeFullscreen)
    videoElement.addEventListener('webkitendfullscreen', syncNativeFullscreen)

    return () => {
      nativeFullscreenEvents.forEach((eventName) => {
        document.removeEventListener(eventName, syncNativeFullscreen)
      })
      videoElement.removeEventListener('webkitbeginfullscreen', syncNativeFullscreen)
      videoElement.removeEventListener('webkitendfullscreen', syncNativeFullscreen)
    }
  }, [isReady])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const videoElement = video

    function syncPictureInPicture() {
      setIsPictureInPicture(isPictureInPictureActive(videoElement))
    }

    setPictureInPictureSupported(canUsePictureInPicture(videoElement))
    syncPictureInPicture()

    videoElement.addEventListener('enterpictureinpicture', syncPictureInPicture)
    videoElement.addEventListener('leavepictureinpicture', syncPictureInPicture)
    videoElement.addEventListener('webkitpresentationmodechanged', syncPictureInPicture)

    return () => {
      videoElement.removeEventListener('enterpictureinpicture', syncPictureInPicture)
      videoElement.removeEventListener('leavepictureinpicture', syncPictureInPicture)
      videoElement.removeEventListener('webkitpresentationmodechanged', syncPictureInPicture)
    }
  }, [isReady])

  useHotkeys('esc', () => setIsWebFullscreen(false), [])

  useEffect(() => {
    if (!isWebFullscreen) return

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsWebFullscreen(false)
      }
    }

    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => document.removeEventListener('keydown', handleDocumentKeyDown)
  }, [isWebFullscreen])

  async function togglePlaying() {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
      return
    }

    await playVideo(video, true)
  }

  function toggleMuted() {
    setPlaybackVolume((current) => current > 0 ? 0 : 0.6)
  }

  function handleProtocolChange(nextProtocol: PlaybackProtocol) {
    setProtocolMenuAnchor(null)
    setProtocol(nextProtocol)
    setPreferredProtocol(nextProtocol)
    setIsPlaying(true)
  }

  function toggleVideoFitMode() {
    setVideoFitMode((current: VideoFitMode) => current === 'cover' ? 'contain' : 'cover')
  }

  async function toggleNativeFullscreen() {
    const player = playerRef.current
    const video = videoRef.current
    if (!player || !video) return

    const fullscreenDocument = document as FullscreenDocument
    const fullscreenPlayer = player as FullscreenPlayerElement
    const fullscreenVideo = video as FullscreenVideoElement

    try {
      const isWebKitVideoFullscreen = fullscreenVideo.webkitDisplayingFullscreen === true

      if (isWebKitVideoFullscreen) {
        fullscreenVideo.webkitExitFullscreen?.()
        return
      }

      if (fullscreenDocument.fullscreenElement ||
        fullscreenDocument.webkitFullscreenElement ||
        fullscreenDocument.msFullscreenElement) {
        await fullscreenDocument.exitFullscreen?.()
        fullscreenDocument.webkitExitFullscreen?.()
        fullscreenDocument.msExitFullscreen?.()
        return
      }

      if (fullscreenDocument.fullscreenEnabled === true && player.requestFullscreen) {
        await player.requestFullscreen()
        return
      }

      if (
        fullscreenDocument.webkitFullscreenEnabled === true &&
        fullscreenPlayer.webkitRequestFullscreen
      ) {
        fullscreenPlayer.webkitRequestFullscreen()
        return
      }

      if (fullscreenVideo.webkitEnterFullscreen) {
        fullscreenVideo.webkitEnterFullscreen()
      }
    } catch (err) {
      warnControlFailure('Native fullscreen', err)
    }
  }

  async function togglePictureInPicture() {
    const video = videoRef.current
    if (!video) return

    const pipDocument = document as PictureInPictureDocument
    const pipVideo = video as PictureInPictureVideoElement

    try {
      if (isPictureInPicture) {
        if (pipDocument.pictureInPictureElement) {
          await pipDocument.exitPictureInPicture?.()
          return
        }

        if (pipVideo.webkitSetPresentationMode) {
          pipVideo.webkitSetPresentationMode('inline')
        }
        return
      }

      if (pipDocument.pictureInPictureEnabled !== false && pipVideo.requestPictureInPicture) {
        await pipVideo.requestPictureInPicture()
        return
      }

      if (
        pipVideo.webkitSupportsPresentationMode?.('picture-in-picture') &&
        pipVideo.webkitSetPresentationMode
      ) {
        pipVideo.webkitSetPresentationMode('picture-in-picture')
      }
    } catch (err) {
      warnControlFailure('Picture in picture', err)
    }
  }

  return (
    <div
      ref={playerRef}
      className={`${styles.player} ${isWebFullscreen ? styles.webFullscreen : ''}`}
      style={playerCssVariables}
    >
      <video
        ref={videoRef}
        className={`${styles.video} ${videoFitMode === 'cover' ? styles.videoCover : styles.videoContain}`}
        crossOrigin="anonymous"
        playsInline
        muted={isMuted}
        onPlay={() => {
          setPlaybackNeedsGesture(false)
          setIsPlaying(true)
        }}
        onPause={() => {
          if (!isSwitchingSourceRef.current) {
            setIsPlaying(false)
          }
        }}
        onVolumeChange={(event) => {
          const nextVolume = event.currentTarget.volume
          if (Math.abs(nextVolume - volumeRef.current) > 0.001) {
            volumeRef.current = nextVolume
            setVolume(nextVolume)
          }
        }}
        onError={() => {
          if (hasPlaybackAccess) {
            setError('Playback failed')
          }
        }}
      />

      <DanmakuOverlay messages={danmakuMessages} settings={danmakuSettings} />

      {!hasPlaybackAccess ? (
        <div className={styles.statusLayer} role="status">
          {roomId ? '等待直播间播放凭证' : '等待直播间信息'}
        </div>
      ) : null}

      {hasPlaybackAccess && !isReady && !error ? (
        <div className={styles.loadingLayer}>Loading</div>
      ) : null}

      {hasPlaybackAccess && error ? (
        <div className={styles.errorLayer} role="alert">{error}</div>
      ) : null}

      {isReady && !isPlaying && !error ? (
        <button
          className={styles.playOverlay}
          type="button"
          onClick={togglePlaying}
        >
          <PlayArrowIcon fontSize="large" />
          {playbackNeedsGesture ? '点击播放' : '播放'}
        </button>
      ) : null}

      <div className={styles.controls}>
        <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
          <span className={styles.playButton}>
            <IconButton
              aria-label={isPlaying ? 'Pause' : 'Play'}
              color="inherit"
              disabled={!hasPlaybackAccess || !currentSource}
              onClick={togglePlaying}
              size="small"
            >
              {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
          </span>
        </Tooltip>

        <div className={styles.volume}>
          <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
            <IconButton
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className={styles.volumeButton}
              color="inherit"
              onClick={toggleMuted}
              size="small"
            >
              {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </IconButton>
          </Tooltip>
          <Slider
            aria-label="Volume"
            className={styles.volumeSlider}
            max={1}
            min={0}
            size="small"
            step={0.01}
            value={volume}
            onChange={(_, value) => {
              setPlaybackVolume(Array.isArray(value) ? value[0] : value)
            }}
          />
        </div>

        <Button
          className={styles.protocolButton}
          color="inherit"
          disabled={!hasPlaybackAccess || protocols.length <= 1}
          size="small"
          sx={{ textTransform: 'none' }}
          variant="text"
          onClick={(event) => setProtocolMenuAnchor(event.currentTarget)}
        >
          {protocol ?? 'source'}
        </Button>
        <Menu
          anchorEl={protocolMenuAnchor}
          open={Boolean(protocolMenuAnchor)}
          onClose={() => setProtocolMenuAnchor(null)}
        >
          {protocols.map((item) => (
            <MenuItem
              key={item}
              selected={item === protocol}
              onClick={() => handleProtocolChange(item)}
            >
              {item}
            </MenuItem>
          ))}
        </Menu>

        <Tooltip title={videoFitMode === 'cover' ? '画面填充：可能裁切边缘' : '画面适应：完整显示'}>
          <Button
            aria-label={videoFitMode === 'cover' ? '当前画面填充：可能裁切边缘' : '当前画面适应：完整显示'}
            className={styles.fitModeButton}
            color="inherit"
            size="small"
            startIcon={<AspectRatioIcon fontSize="small" />}
            variant="text"
            onClick={toggleVideoFitMode}
          >
            {videoFitMode === 'cover' ? '填充' : '适应'}
          </Button>
        </Tooltip>

        {shouldShowPageFullscreenControl(isNativeFullscreen) ? (
          <Tooltip title={isWebFullscreen ? 'Exit page full screen' : 'Page full screen'}>
            <IconButton
              aria-label={isWebFullscreen ? 'Exit page full screen' : 'Page full screen'}
              className={styles.pageFullscreenButton}
              color="inherit"
              onClick={() => setIsWebFullscreen((current) => !current)}
              size="small"
            >
              {isWebFullscreen ? <FullscreenExitIcon /> : <FitScreenIcon />}
            </IconButton>
          </Tooltip>
        ) : null}

        <Tooltip title={isNativeFullscreen ? 'Exit full screen' : 'Full screen'}>
          <span className={styles.nativeFullscreenButton}>
            <IconButton
              aria-label={isNativeFullscreen ? 'Exit full screen' : 'Full screen'}
              color="inherit"
              disabled={!nativeFullscreenSupported}
              onClick={toggleNativeFullscreen}
              size="small"
            >
              {isNativeFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={isPictureInPicture ? 'Exit picture in picture' : 'Picture in picture'}>
          <span className={styles.pictureInPictureButton}>
            <IconButton
              aria-label={isPictureInPicture ? 'Exit picture in picture' : 'Picture in picture'}
              color="inherit"
              disabled={!currentSource || !isReady || !pictureInPictureSupported}
              onClick={togglePictureInPicture}
              size="small"
            >
              <PictureInPictureAltIcon />
            </IconButton>
          </span>
        </Tooltip>
      </div>
    </div>
  )
}

export default MoyuPlayer
