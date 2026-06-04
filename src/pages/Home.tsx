import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Stack,
  Typography
} from '@mui/material'
import LiveTvIcon from '@mui/icons-material/LiveTv'
import RssFeedIcon from '@mui/icons-material/RssFeed'
import ScheduleIcon from '@mui/icons-material/Schedule'
import SpeedIcon from '@mui/icons-material/Speed'

import { listLiveRooms, type LiveRoom } from '../libs/api'

const REFRESH_INTERVAL_MS = 10000

function formatStartTime(value: number | null): string {
  if (value == null) return '开播时间未知'
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '开播时间未知'

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}小时${minutes.toString().padStart(2, '0')}分钟`
  }
  return `${Math.max(1, minutes)}分钟`
}

function formatResolution(room: LiveRoom): string {
  if (!room.video_width || !room.video_height) return '分辨率未知'
  return `${room.video_width}x${room.video_height}`
}

function formatBitrate(room: LiveRoom): string {
  if (room.recv_kbps == null) return '码率未知'
  return `${room.recv_kbps} kbps`
}

function roomDisplayTitle(room: LiveRoom): string {
  return room.title?.trim() || room.stream_id
}

export default function Home() {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<LiveRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchRooms = useCallback(async () => {
    try {
      const data = await listLiveRooms()
      setRooms(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取直播间列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const openRoom = useCallback((room: LiveRoom) => {
    navigate(`/live/${encodeURIComponent(room.stream_id)}`)
  }, [navigate])

  useEffect(() => {
    fetchRooms()
    const timer = window.setInterval(fetchRooms, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [fetchRooms])

  return (
    <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, md: 5 }, width: '100%' }}>
      <Stack spacing={{ xs: 2.5, md: 3 }}>
        <Box
          sx={{
            alignItems: { xs: 'flex-start', sm: 'center' },
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1.5, sm: 2 },
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="h1"
              variant="h4"
              sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' }, fontWeight: 700 }}
            >
              直播间
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              当前正在直播
            </Typography>
          </Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', rowGap: 1 }}
          >
            <Chip
              color="error"
              icon={<LiveTvIcon />}
              label={`${rooms.length} 个直播中`}
              variant="outlined"
            />
            <Button
              color="inherit"
              component="a"
              href="/feeds/live.xml"
              size="small"
              startIcon={<RssFeedIcon />}
              sx={{ borderRadius: 1, minHeight: 32 }}
              variant="outlined"
            >
              RSS
            </Button>
          </Stack>
        </Box>

        {error ? <Alert severity="error">{error}</Alert> : null}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : rooms.length === 0 ? (
          <Box
            sx={{
              alignItems: 'center',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              color: 'text.secondary',
              display: 'flex',
              justifyContent: 'center',
              minHeight: { xs: 180, sm: 220 },
              px: 3,
              textAlign: 'center'
            }}
          >
            当前没有进行中的直播
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gap: { xs: 2, sm: 2.5 },
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))'
              },
              minWidth: 0,
              width: '100%'
            }}
          >
            {rooms.map((room) => (
              <Card
                key={`${room.app}/${room.stream_id}`}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  height: '100%',
                  minWidth: 0,
                  width: '100%'
                }}
              >
                <CardActionArea
                  onClick={() => openRoom(room)}
                  sx={{ alignItems: 'stretch', display: 'flex', flexDirection: 'column', height: '100%' }}
                >
                  <Box
                    sx={{
                      alignItems: 'center',
                      aspectRatio: '16 / 9',
                      bgcolor: '#111',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      justifyContent: 'center',
                      position: 'relative',
                      width: '100%'
                    }}
                  >
                    <Chip
                      color="error"
                      label="LIVE"
                      size="small"
                      sx={{ fontWeight: 700, left: 12, position: 'absolute', top: 12 }}
                    />
                    <LiveTvIcon sx={{ color: 'rgba(255,255,255,0.34)', fontSize: 56 }} />
                  </Box>

                  <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 2 }, width: '100%' }}>
                    <Stack spacing={1.25}>
                      <Typography
                        component="h2"
                        variant="h6"
                        sx={{
                          fontSize: { xs: '1rem', sm: '1.25rem' },
                          fontWeight: 700,
                          lineHeight: 1.25,
                          overflowWrap: 'anywhere'
                        }}
                      >
                        {roomDisplayTitle(room)}
                      </Typography>
                      {roomDisplayTitle(room) !== room.stream_id ? (
                        <Typography color="text.secondary" variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                          房间 {room.stream_id}
                        </Typography>
                      ) : null}

                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'flex-start', color: 'text.secondary', minWidth: 0 }}
                      >
                        <ScheduleIcon fontSize="small" sx={{ flexShrink: 0, mt: 0.25 }} />
                        <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                          {formatStartTime(room.started_at_ms)} · {formatDuration(room.live_ms)}
                        </Typography>
                      </Stack>

                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'flex-start', color: 'text.secondary', minWidth: 0 }}
                      >
                        <SpeedIcon fontSize="small" sx={{ flexShrink: 0, mt: 0.25 }} />
                        <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                          {formatResolution(room)} · {formatBitrate(room)}
                        </Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        )}
      </Stack>
    </Container>
  )
}
