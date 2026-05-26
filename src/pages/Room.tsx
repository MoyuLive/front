import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Container } from '@mui/material'
import ReactPlayer from 'react-player/file'
import { useHotkeys } from 'react-hotkeys-hook'
import { useAtom } from 'jotai'

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
const whepBaseURL = import.meta.env.VITE_STREAMSERVER
console.log('stream server: ', whepBaseURL)

async function retry<T>(
  fn: () => Promise<T>,
  times: number,
  delay = 0
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (times > 0) {
      console.log(
        'get an error',
        err,
        'retrying in',
        delay,
        'ms',
        'times left',
        times
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
      return await retry(fn, times - 1, delay * 2)
    } else {
      throw err
    }
  }
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

function whepUrl(roomId: string) {
  const url = new URL(`${whepBaseURL}/rtc/v1/whep/`)
  url.searchParams.set('app', 'live')
  url.searchParams.set('stream', roomId)
  url.searchParams.set('token', '')
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

  useEffect(() => {
    console.log('room:', room)
  }, [room])

  // browser full screen callbacks
  useHotkeys(
    'ctrl+enter',
    () => {
      console.log('full screen')
      setBrowserFullScreen(true)
    },
    []
  )

  useHotkeys(
    'esc',
    () => {
      console.log('exit full screen')
      setBrowserFullScreen(false)
    },
    []
  )

  // setup whep client
  useEffect(() => {
    if (!room) return

    console.log('init webrtc')

    //Create peerconnection
    const pc = new RTCPeerConnection({
      iceServers: getIceServers()
    })
    window.pc = pc

    //Add recv only transceivers
    pc.addTransceiver('audio')
    pc.addTransceiver('video')

    pc.ontrack = (event) => {
      console.log(event)
      if (event.track.kind == 'video') {
        setVideoStream(event.streams[0])
        // video.srcObject = event.streams[0]
        // video.controls = true
      }
    }

    //Create whep client
    const whep = new WHEPClient()

    window.whepClient = whep
    const abortCtrlor = new AbortController()

    const url = whepUrl(room)
    //const token = ""

    //Start viewing
    whep.view(pc, url, '', abortCtrlor.signal).catch((err) => console.log(err))

    return () => {
      abortCtrlor.abort()
      whep
        .stop()
        .catch((err) => console.log(err))
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

  // useEffect(() => {
  //   const timer = setInterval(() => {
  //     if (videoRef.current) {
  //       console.log('remove src from video', videoRef.current)
  //       videoRef.current.removeAttribute('src')
  //     }
  //   }, 1)
  //   return () => clearInterval(timer)
  // }, [room, video])

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
