import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Snackbar,
  Alert,
  InputAdornment,
  IconButton
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

import { getStreamCode, resetStreamCode } from '../libs/api'
import { buildRtmpPublishUrl, DEFAULT_RTMP_HOST } from '../libs/streamUrls'

const RTMP_HOST = import.meta.env.VITE_RTMP_HOST || DEFAULT_RTMP_HOST

export default function AdminStreamCode() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const fetchCode = useCallback(async () => {
    try {
      const data = await getStreamCode()
      setCode(data.stream_code)
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '获取推流码失败',
        severity: 'error'
      })
    }
  }, [])

  useEffect(() => {
    fetchCode()
  }, [fetchCode])

  const handleReset = async () => {
    setLoading(true)
    try {
      const data = await resetStreamCode()
      setCode(data.stream_code)
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

  const rtmpUrl = buildRtmpPublishUrl(RTMP_HOST, 'STREAM', code)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setSnackbar({ open: true, message: '已复制到剪贴板', severity: 'success' })
    })
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        推流码管理
      </Typography>
      <Card sx={{ maxWidth: 600 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            当前推流码
          </Typography>
          <TextField
            value={code}
            fullWidth
            variant="outlined"
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => handleCopy(code)} edge="end">
                    <ContentCopyIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            color="warning"
            onClick={handleReset}
            disabled={loading}
            startIcon={<RefreshIcon />}
            sx={{ mb: 3 }}
          >
            {loading ? '重置中...' : '重置推流码'}
          </Button>

          <Typography variant="subtitle1" gutterBottom>
            推流地址 (RTMP)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            请将以下地址配置到 OBS 或其他推流软件中：
          </Typography>
          <TextField
            value={rtmpUrl}
            fullWidth
            variant="outlined"
            size="small"
            multiline
            maxRows={2}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => handleCopy(rtmpUrl)} edge="end">
                    <ContentCopyIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </CardContent>
      </Card>
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
