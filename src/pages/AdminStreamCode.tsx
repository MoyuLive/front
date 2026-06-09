import { type ReactNode, useState, useEffect, useCallback } from 'react'
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
import RefreshIcon from '@mui/icons-material/Refresh'
import SaveIcon from '@mui/icons-material/Save'

import {
  getPublishProtocols,
  getStreamCode,
  resetStreamCode,
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

const RTMP_HOST = import.meta.env.VITE_RTMP_HOST || DEFAULT_RTMP_HOST
const WHIP_BASE =
  import.meta.env.VITE_WHIP_BASE || import.meta.env.VITE_STREAMSERVER || DEFAULT_WHIP_BASE
const SRT_HOST = import.meta.env.VITE_SRT_HOST || DEFAULT_SRT_HOST
const MAX_ROOM_TITLE_CHARS = 80

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

export default function AdminStreamCode() {
  const [code, setCode] = useState('')
  const [streamId, setStreamId] = useState('')
  const [roomTitle, setRoomTitle] = useState('')
  const [publishProtocols, setPublishProtocols] = useState<PublishProtocol[]>(['rtmp'])
  const [loading, setLoading] = useState(false)
  const [savingTitle, setSavingTitle] = useState(false)
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
