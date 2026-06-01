import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Container, ToggleButton, ToggleButtonGroup } from '@mui/material'
import ReactPlayer from 'react-player/file'
import { useHotkeys } from 'react-hotkeys-hook'
import { useAtom } from 'jotai'

// Fallback video used when no live stream is active
import exampleVideo from '../assets/肥肠抱歉.mp4'
import {
  AVAILABLE_PLAYBACK_PROTOCOLS,
  buildFlvPlaybackUrl,
  buildHlsPlaybackUrl,
  buildWhepUrl,
  DEFAULT_WHEP_BASE,
  type PlaybackProtocol
} from '../libs/streamUrls'
import { WHEPClient } from '../libs/whep'
import css from '../css/player.module.scss'
import { playerVolumeAtom } from '../storages/player'

declare global {
  interface Window {
    pc?: RTCPeerConnection
    whepClient?: WHEPClient
  }
}

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

export default function Room() {
  const params = useParams()
  const { roomId } = params

  const [room, setRoom] = useState(roomId ?? null)
  const videoRef = useRef<ReactPlayer>(null)

  const [videoStream, setVideoStream] = useState<MediaStream>()
  const [playing, setPlaying] = useState<boolean>()
  const [playbackProtocol, setPlaybackProtocol] = useState<PlaybackProtocol>('webrtc')

  const [browserFullScreen, setBrowserFullScreen] = useState<boolean>(false)

  const [playerVolume, setPlayerVolume] = useAtom(playerVolumeAtom)
  const hlsUrl = room ? buildHlsPlaybackUrl(room) : undefined
  const flvUrl = room ? buildFlvPlaybackUrl(room) : undefined
  const playerUrl = playbackProtocol === 'webrtc'
    ? (videoStream || exampleVideo)
    : ((playbackProtocol === 'hls' ? hlsUrl : flvUrl) || exampleVideo)
  const playerPlaying = playbackProtocol === 'webrtc' && !videoStream ? false : playing

  useEffect(() => {
    const { roomId } = params
    setRoom(roomId ?? '')
  }, [params])

  // browser full screen callbacks
  useHotkeys(
    'ctrl+enter',
    () => {
      setBrowserFullScreen(true)
    },
    []
  )

  useHotkeys(
    'esc',
    () => {
      setBrowserFullScreen(false)
    },
    []
  )

  // setup whep client
  useEffect(() => {
    if (!room || playbackProtocol !== 'webrtc') {
      setVideoStream(undefined)
      return
    }

    //Create peerconnection
    const pc = new RTCPeerConnection({
      iceServers: getIceServers()
    })
    window.pc = pc

    //Add recv only transceivers
    pc.addTransceiver('audio')
    pc.addTransceiver('video')

    pc.ontrack = (event) => {
      if (event.track.kind === 'video') {
        setVideoStream(event.streams[0])
      }
    }

    //Create whep client
    const whep = new WHEPClient()

    window.whepClient = whep
    const abortCtrlor = new AbortController()

    const url = buildWhepUrl(whepBaseURL, room, localStorage.getItem('jwt') || '')

    //Start viewing
    whep.view(pc, url, localStorage.getItem('jwt') || '', abortCtrlor.signal).catch((err) => console.error(err))

    return () => {
      abortCtrlor.abort()
      whep
        .stop()
        .catch((err) => console.error(err))
        .finally(() => {
          pc.close()
          window.pc = undefined
        })
    }
  }, [room, playbackProtocol])

  useEffect(() => {
    if (videoStream && playing === undefined) {
      setPlaying(true)
    }
  }, [videoStream, playing])

  useEffect(() => {
    if (playbackProtocol !== 'webrtc' && room && playing === undefined) {
      setPlaying(true)
    }
  }, [playbackProtocol, room, playing])

  return (
    <>
      <Container
        maxWidth="xl"
        sx={{
          alignContent: 'center',
          justifyContent: 'center',
          marginTop: '20px'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={playbackProtocol}
            onChange={(_, value: PlaybackProtocol | null) => {
              if (value) {
                setPlaybackProtocol(value)
              }
            }}
          >
            {AVAILABLE_PLAYBACK_PROTOCOLS.map((protocol) => (
              <ToggleButton
                key={protocol}
                value={protocol}
                sx={{ minWidth: 82, textTransform: 'none' }}
              >
                {protocol}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <div
          className={
            browserFullScreen
              ? css.playerContainerFullscreen
              : css.playerContainerNormal
          }
        >
          <ReactPlayer
            width="100%"
            height="100%"
            ref={videoRef}
            muted={(playbackProtocol === 'webrtc' && !videoStream) || playerVolume <= 0}
            controls
            playing={playerPlaying}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            url={playerUrl}
            preload="none"
            volume={playerVolume}
            playsinline
            config={{
              attributes: {
                preload: 'none',
                onVolumeChange: (e: Event) => {
                  const target = e.target as HTMLVideoElement
                  setPlayerVolume(target.volume)
                }
              }
            }}
          />
        </div>
      </Container>
    </>
  )
}
