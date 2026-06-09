import {
  type ChangeEvent,
  type ReactNode,
  useState,
  useEffect,
  useCallback,
  useRef
} from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import ImageIcon from '@mui/icons-material/Image'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import RefreshIcon from '@mui/icons-material/Refresh'
import SaveIcon from '@mui/icons-material/Save'

import {
  getPublishProtocols,
  getStreamCode,
  resetStreamCode,
  resolveApiAssetUrl,
  updateRoomCover,
  updateRoomTitle
} from '../libs/api'
import {
  buildRtmpPublishUrl,
  buildRtmpServerUrl,
  buildRtmpStreamKey,
  buildSrtPublishUrl,
  buildSrtStreamId,
  buildWhipPublishUrl,
  DEFAULT_RTMP_HOST,
  DEFAULT_SRT_HOST,
  DEFAULT_WHIP_BASE,
  normalizePublishProtocols,
  PublishProtocol
} from '../libs/streamUrls'
import MoyuPlayer from '../components/player/MoyuPlayer'

const RTMP_HOST = import.meta.env.VITE_RTMP_HOST || DEFAULT_RTMP_HOST
const WHIP_BASE =
  import.meta.env.VITE_WHIP_BASE || import.meta.env.VITE_STREAMSERVER || DEFAULT_WHIP_BASE
const SRT_HOST = import.meta.env.VITE_SRT_HOST || DEFAULT_SRT_HOST
const MAX_ROOM_TITLE_CHARS = 80
const MAX_COVER_UPLOAD_BYTES = 5 * 1024 * 1024

interface CopyFieldProps {
  label: string
  value: string
  multiline?: boolean
  onCopy: (text: string) => void
}

interface ProtocolSectionProps {
  title: string
  children: ReactNode
}

function CopyField({ label, value, multiline = false, onCopy }: CopyFieldProps) {
  return (
    <TextField
      label={label}
      value={value}
      fullWidth
      variant="outlined"
      size="small"
      multiline={multiline}
      minRows={multiline ? 2 : undefined}
      InputProps={{
        readOnly: true,
        endAdornment: (
          <InputAdornment position="end">
            <IconButton onClick={() => onCopy(value)} edge="end" disabled={!value}>
              <ContentCopyIcon />
            </IconButton>
          </InputAdornment>
        )
      }}
      sx={
        multiline
          ? {
              '& .MuiInputBase-input': {
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                overflowWrap: 'anywhere',
                wordBreak: 'break-all'
              },
              '& textarea': {
                overflow: 'hidden !important',
                resize: 'none',
                whiteSpace: 'pre-wrap'
              }
            }
          : undefined
      }
    />
  )
}

function ProtocolSection({ title, children }: ProtocolSectionProps) {
  return (
    <Stack
      spacing={1.5}
      sx={{
        minWidth: 0,
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 2
      }}
    >
      <Typography variant="subtitle2">{title}</Typography>
      {children}
    </Stack>
  )
}

function captureVideoFrame(video: HTMLVideoElement): Promise<Blob> {
  if (!video.videoWidth || !video.videoHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.reject(new Error('当前直播画面不可用'))
  }

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (!context) {
    return Promise.reject(new Error('当前浏览器无法截取画面'))
  }

  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
  } catch {
    return Promise.reject(new Error('当前播放源不允许截取画面'))
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('截取画面失败'))
        }
      },
      'image/jpeg',
      0.88
    )
  })
}

export default function AdminStreamCode() {
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [streamId, setStreamId] = useState('')
  const [roomTitle, setRoomTitle] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [previewVideo, setPreviewVideo] = useState<HTMLVideoElement | null>(null)
  const [publishProtocols, setPublishProtocols] = useState<PublishProtocol[]>(['rtmp'])
  const [loading, setLoading] = useState(false)
  const [savingTitle, setSavingTitle] = useState(false)
  const [savingCover, setSavingCover] = useState(false)
  const [protocolsLoading, setProtocolsLoading] = useState(false)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const fetchCode = useCallback(async () => {
    try {
      const data = await getStreamCode()
      setCode(data.stream_code)
      setStreamId(data.stream_id)
      setRoomTitle(data.title ?? data.stream_id)
      setCoverUrl(data.cover_url ?? '')
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '获取推流码失败',
        severity: 'error'
      })
    }
  }, [])

  const fetchPublishProtocols = useCallback(async () => {
    setProtocolsLoading(true)
    try {
      const data = await getPublishProtocols()
      setPublishProtocols(normalizePublishProtocols(data.protocols))
    } catch (err) {
      setPublishProtocols(normalizePublishProtocols([]))
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '获取推流协议失败',
        severity: 'error'
      })
    } finally {
      setProtocolsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCode()
    fetchPublishProtocols()
  }, [fetchCode, fetchPublishProtocols])

  const handleReset = async () => {
    setLoading(true)
    try {
      const data = await resetStreamCode()
      setCode(data.stream_code)
      setStreamId(data.stream_id)
      setCoverUrl(data.cover_url ?? '')
      setSnackbar({ open: true, message: '推流码已重置', severity: 'success' })
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '重置失败',
        severity: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTitle = async () => {
    setSavingTitle(true)
    try {
      const data = await updateRoomTitle(roomTitle)
      setRoomTitle(data.title)
      setSnackbar({ open: true, message: '直播间标题已保存', severity: 'success' })
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '保存失败',
        severity: 'error'
      })
    } finally {
      setSavingTitle(false)
    }
  }

  const handleSaveCover = async (file: Blob) => {
    if (file.size > MAX_COVER_UPLOAD_BYTES) {
      setSnackbar({ open: true, message: '封面图片不能超过 5MB', severity: 'error' })
      return
    }

    setSavingCover(true)
    try {
      const data = await updateRoomCover(file)
      setCoverUrl(data.cover_url)
      setSnackbar({ open: true, message: '直播间封面已保存', severity: 'success' })
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '保存封面失败',
        severity: 'error'
      })
    } finally {
      setSavingCover(false)
    }
  }

  const handleCoverFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setSnackbar({ open: true, message: '请选择图片文件', severity: 'error' })
      return
    }

    await handleSaveCover(file)
  }

  const handleCaptureCover = async () => {
    if (!previewVideo) {
      setSnackbar({ open: true, message: '直播预览未就绪', severity: 'error' })
      return
    }

    try {
      const blob = await captureVideoFrame(previewVideo)
      await handleSaveCover(blob)
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '截取画面失败',
        severity: 'error'
      })
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setSnackbar({ open: true, message: '已复制到剪贴板', severity: 'success' })
    })
  }

  const streamName = streamId || 'STREAM'
  const rtmpServer = buildRtmpServerUrl(RTMP_HOST)
  const rtmpStreamKey = buildRtmpStreamKey(streamName, code)
  const rtmpUrl = buildRtmpPublishUrl(RTMP_HOST, streamName, code)
  const whipUrl = buildWhipPublishUrl(WHIP_BASE, streamName, code)
  const srtUrl = buildSrtPublishUrl(SRT_HOST, streamName, code)
  const srtStreamId = buildSrtStreamId(streamName, code)
  const titleLength = Array.from(roomTitle).length
  const resolvedCoverUrl = resolveApiAssetUrl(coverUrl)

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        推流码管理
      </Typography>

      <Stack spacing={3} sx={{ width: '100%', maxWidth: 1280 }}>
        <Card sx={{ maxWidth: 820 }}>
          <CardContent>
            <Stack spacing={2.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                <Typography variant="h6">直播身份</Typography>
                <Button
                  variant="contained"
                  color="warning"
                  onClick={handleReset}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
                >
                  重置推流码
                </Button>
              </Stack>

              <CopyField label="推流码" value={code} onCopy={handleCopy} />
              <CopyField label="直播间 ID" value={streamId} onCopy={handleCopy} />

              <Box>
                <TextField
                  label="直播间标题"
                  value={roomTitle}
                  fullWidth
                  helperText={`${titleLength}/${MAX_ROOM_TITLE_CHARS}`}
                  inputProps={{ maxLength: MAX_ROOM_TITLE_CHARS }}
                  onChange={(event) => setRoomTitle(event.target.value)}
                  placeholder={streamId || '直播间标题'}
                  sx={{ mb: 1.5 }}
                />
                <Button
                  disabled={savingTitle}
                  onClick={handleSaveTitle}
                  startIcon={savingTitle ? <CircularProgress size={18} /> : <SaveIcon />}
                  variant="contained"
                >
                  保存标题
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ maxWidth: 820 }}>
          <CardContent>
            <Stack spacing={2.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                <Typography variant="h6">直播间封面</Typography>
                {savingCover ? <CircularProgress size={22} /> : null}
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(240px, 320px) 1fr' },
                  minWidth: 0
                }}
              >
                <Box
                  sx={{
                    alignItems: 'center',
                    aspectRatio: '16 / 9',
                    bgcolor: '#111',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    color: 'rgba(255,255,255,0.56)',
                    display: 'flex',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative',
                    width: '100%'
                  }}
                >
                  {resolvedCoverUrl ? (
                    <Box
                      alt=""
                      component="img"
                      src={resolvedCoverUrl}
                      sx={{ height: '100%', objectFit: 'cover', width: '100%' }}
                    />
                  ) : (
                    <Stack alignItems="center" spacing={1}>
                      <ImageIcon fontSize="large" />
                      <Typography variant="body2">未设置封面</Typography>
                    </Stack>
                  )}
                </Box>

                <Stack spacing={1.5} sx={{ alignSelf: 'center', minWidth: 0 }}>
                  <input
                    ref={coverInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    type="file"
                    onChange={handleCoverFileChange}
                  />
                  <Button
                    disabled={savingCover}
                    onClick={() => coverInputRef.current?.click()}
                    startIcon={<CloudUploadIcon />}
                    variant="outlined"
                  >
                    上传图片
                  </Button>
                  <Button
                    disabled={savingCover || !streamId}
                    onClick={handleCaptureCover}
                    startIcon={<PhotoCameraIcon />}
                    variant="contained"
                  >
                    截取当前画面
                  </Button>
                </Stack>
              </Box>

              {streamId ? (
                <Box sx={{ width: '100%' }}>
                  <MoyuPlayer
                    roomId={streamId}
                    onVideoElementChange={setPreviewVideo}
                  />
                </Box>
              ) : null}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                <Typography variant="h6">推流连接</Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {protocolsLoading && <Chip label="加载中" size="small" />}
                  {publishProtocols.map((protocol) => (
                    <Chip key={protocol} label={protocol.toUpperCase()} size="small" />
                  ))}
                </Stack>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                  gap: 2,
                  alignItems: 'stretch'
                }}
              >
                {publishProtocols.includes('rtmp') && (
                  <ProtocolSection title="RTMP">
                    <CopyField label="OBS 服务器" value={rtmpServer} onCopy={handleCopy} />
                    <CopyField label="OBS 串流密钥" value={rtmpStreamKey} onCopy={handleCopy} multiline />
                    <CopyField label="完整 URL" value={rtmpUrl} onCopy={handleCopy} multiline />
                  </ProtocolSection>
                )}

                {publishProtocols.includes('whip') && (
                  <ProtocolSection title="WHIP">
                    <CopyField label="Endpoint" value={whipUrl} onCopy={handleCopy} multiline />
                    <CopyField label="Bearer Token" value={code} onCopy={handleCopy} />
                  </ProtocolSection>
                )}

                {publishProtocols.includes('srt') && (
                  <ProtocolSection title="SRT">
                    <CopyField label="URL" value={srtUrl} onCopy={handleCopy} multiline />
                    <CopyField label="Stream ID" value={srtStreamId} onCopy={handleCopy} multiline />
                  </ProtocolSection>
                )}
              </Box>

              {publishProtocols.length === 0 && (
                <Alert severity="warning">未启用推流协议</Alert>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
