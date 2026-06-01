import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  IconButton,
  Menu,
  MenuItem,
  Slider,
  Tooltip
} from '@mui/material'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import { useHotkeys } from 'react-hotkeys-hook'
import { useAtom } from 'jotai'

import { getPlaybackProtocols } from '../../libs/api'
import {
  DEFAULT_PLAYBACK_PROTOCOLS,
  DEFAULT_WHEP_BASE,
  normalizePlaybackProtocols,
  type PlaybackProtocol
} from '../../libs/streamUrls'
import { playerVolumeAtom } from '../../storages/player'

import styles from './MoyuPlayer.module.scss'
import { attachPlaybackSource, type PlaybackHandle } from './playbackAdapters'
import {
  buildMoyuPlayerSources,
  pickInitialProtocol
} from './playerSources'

const whepBaseURL = import.meta.env.VITE_WHEP_BASE || DEFAULT_WHEP_BASE

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

export interface MoyuPlayerProps {
  roomId: string
}

export default function MoyuPlayer({ roomId }: MoyuPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playbackRef = useRef<PlaybackHandle>()
  const isPlayingRef = useRef(true)
  const isSwitchingSourceRef = useRef(false)
  const [volume, setVolume] = useAtom(playerVolumeAtom)
  const [protocols, setProtocols] = useState<PlaybackProtocol[]>([])
  const [protocol, setProtocol] = useState<PlaybackProtocol>()
  const [isPlaying, setIsPlaying] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [isWebFullscreen, setIsWebFullscreen] = useState(false)
  const [error, setError] = useState<string>()
  const [protocolMenuAnchor, setProtocolMenuAnchor] = useState<null | HTMLElement>(null)
  const token = useMemo(() => localStorage.getItem('jwt') || '', [])

  const sources = useMemo(
    () => buildMoyuPlayerSources({
      roomId,
      token,
      protocols,
      whepBaseUrl: whepBaseURL
    }),
    [protocols, roomId, token]
  )
  const currentSource = sources.find((source) => source.protocol === protocol)
  const isMuted = volume <= 0 || (protocol === 'webrtc' && !isReady)

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

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
        setProtocols(nextProtocols)
        setProtocol((current) => pickInitialProtocol(nextProtocols, current))
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !currentSource || !roomId) {
      return
    }

    let cancelled = false
    isSwitchingSourceRef.current = true
    setIsReady(false)
    setError(undefined)
    playbackRef.current?.destroy()
    playbackRef.current = undefined

    attachPlaybackSource({
      video,
      source: currentSource,
      token,
      iceServers: getIceServers(),
      onReady: () => {
        if (cancelled) return
        isSwitchingSourceRef.current = false
        setIsReady(true)
        if (isPlayingRef.current) {
          void video.play().catch(() => setIsPlaying(false))
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
      const handle = playbackRef.current
      playbackRef.current = undefined
      void handle?.destroy()
    }
  }, [currentSource, roomId, token])

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

  useHotkeys('esc', () => setIsWebFullscreen(false), [])

  async function togglePlaying() {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
      return
    }

    try {
      await video.play()
      setIsPlaying(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Playback failed')
    }
  }

  function toggleMuted() {
    setVolume((current) => current > 0 ? 0 : 0.6)
  }

  function handleProtocolChange(nextProtocol: PlaybackProtocol) {
    setProtocolMenuAnchor(null)
    setProtocol(nextProtocol)
    setIsPlaying(true)
  }

  return (
    <div className={`${styles.player} ${isWebFullscreen ? styles.webFullscreen : ''}`}>
      <video
        ref={videoRef}
        className={styles.video}
        playsInline
        muted={isMuted}
        onPlay={() => setIsPlaying(true)}
        onPause={() => {
          if (!isSwitchingSourceRef.current) {
            setIsPlaying(false)
          }
        }}
        onVolumeChange={(event) => {
          setVolume(event.currentTarget.volume)
        }}
        onError={() => {
          setError('Playback failed')
        }}
      />

      {!isReady && !error ? (
        <div className={styles.loadingLayer}>Loading</div>
      ) : null}

      {error ? (
        <div className={styles.errorLayer}>{error}</div>
      ) : null}

      <div className={styles.controls}>
        <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
          <span>
            <IconButton
              aria-label={isPlaying ? 'Pause' : 'Play'}
              color="inherit"
              disabled={!currentSource}
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
              color="inherit"
              onClick={toggleMuted}
              size="small"
            >
              {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </IconButton>
          </Tooltip>
          <Slider
            aria-label="Volume"
            max={1}
            min={0}
            size="small"
            step={0.01}
            value={volume}
            onChange={(_, value) => {
              setVolume(Array.isArray(value) ? value[0] : value)
            }}
          />
        </div>

        <Button
          className={styles.protocolButton}
          color="inherit"
          disabled={protocols.length <= 1}
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

        <Tooltip title={isWebFullscreen ? 'Exit full screen' : 'Full screen'}>
          <IconButton
            aria-label={isWebFullscreen ? 'Exit full screen' : 'Full screen'}
            color="inherit"
            onClick={() => setIsWebFullscreen((current) => !current)}
            size="small"
          >
            {isWebFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Tooltip>
      </div>
    </div>
  )
}
