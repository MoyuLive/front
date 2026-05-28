import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Container } from '@mui/material'
import ReactPlayer from 'react-player/file'
import { useHotkeys } from 'react-hotkeys-hook'
import { useAtom } from 'jotai'

// Fallback video used when no live stream is active
import exampleVideo from '../assets/肥肠抱歉.mp4'
import { WHEPClient } from '../libs/whep'
import css from '../css/player.module.scss'
import { playerVolumeAtom } from '../storages/player'

declare global {
  interface Window {
    pc?: RTCPeerConnection
    whepClient?: WHEPClient
  }
}

// const whepBaseURL = 'http://100.64.0.6:8081'
const whepBaseURL = import.meta.env.VITE_STREAMSERVER || 'http://localhost:1985'

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

function whepUrl(roomId: string) {
  const url = new URL(`${whepBaseURL}/rtc/v1/whep/`)
  url.searchParams.set('app', 'live')
  url.searchParams.set('stream', roomId)
  url.searchParams.set('token', localStorage.getItem('jwt') || '')
  return url.toString()
}

export default function Room() {
  const params = useParams()
  const { roomId } = params

  const [room, setRoom] = useState(roomId ?? null)
  const videoRef = useRef<ReactPlayer>(null)

  const [videoStream, setVideoStream] = useState<MediaStream>()
  const [playing, setPlaying] = useState<boolean>()

  const [browserFullScreen, setBrowserFullScreen] = useState<boolean>(false)

  const [playerVolume, setPlayerVolume] = useAtom(playerVolumeAtom)

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
    if (!room) return

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

    const url = whepUrl(room)

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
  }, [room])

  useEffect(() => {
    if (videoStream && playing === undefined) {
      setPlaying(true)
    }
  }, [videoStream, playing])

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
            muted={!videoStream || playerVolume <= 0}
            controls
            playing={playing}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            url={videoStream || exampleVideo}
            preload="none"
            volume={playerVolume}
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
