import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Stack,
  Typography
} from '@mui/material'
import LiveTvIcon from '@mui/icons-material/LiveTv'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import ScheduleIcon from '@mui/icons-material/Schedule'
import SpeedIcon from '@mui/icons-material/Speed'

import { listLiveRooms, type LiveRoom } from '../libs/api'

const REFRESH_INTERVAL_MS = 10000

function formatStartTime(value: string | null): string {
  if (!value) return '开播时间未知'
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
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
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, width: '100%' }}>
      <Stack spacing={3}>
        <Box
          sx={{
            alignItems: { xs: 'flex-start', sm: 'center' },
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            justifyContent: 'space-between'
          }}
        >
          <Box>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 700 }}>
              直播间
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              当前正在直播
            </Typography>
          </Box>
          <Chip
            color="error"
            icon={<LiveTvIcon />}
            label={`${rooms.length} 个直播中`}
            variant="outlined"
          />
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
              minHeight: 220,
              px: 3,
              textAlign: 'center'
            }}
          >
            当前没有进行中的直播
          </Box>
        ) : (
          <Grid container spacing={2.5}>
            {rooms.map((room) => (
              <Grid item key={`${room.app}/${room.stream_id}`} xs={12} sm={6} md={4}>
                <Card
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    height: '100%'
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

                    <CardContent sx={{ flexGrow: 1, width: '100%' }}>
                      <Stack spacing={1.25}>
                        <Typography
                          component="h2"
                          variant="h6"
                          sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}
                        >
                          {room.stream_id}
                        </Typography>

                        <Stack direction="row" spacing={1} sx={{ color: 'text.secondary' }}>
                          <ScheduleIcon fontSize="small" />
                          <Typography variant="body2">
                            {formatStartTime(room.started_at)} · {formatDuration(room.live_ms)}
                          </Typography>
                        </Stack>

                        <Stack direction="row" spacing={1} sx={{ color: 'text.secondary' }}>
                          <PeopleAltIcon fontSize="small" />
                          <Typography variant="body2">
                            {room.clients} 在线连接 · {formatResolution(room)}
                          </Typography>
                        </Stack>

                        <Stack direction="row" spacing={1} sx={{ color: 'text.secondary' }}>
                          <SpeedIcon fontSize="small" />
                          <Typography variant="body2">{formatBitrate(room)}</Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Stack>
    </Container>
  )
}
