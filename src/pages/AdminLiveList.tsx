import { useState, useEffect, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Typography,
  Box,
  Snackbar,
  Alert
} from '@mui/material'
import StopIcon from '@mui/icons-material/Stop'
import { listStreams, stopStream, StreamInfo } from '../libs/api'

export default function AdminLiveList() {
  const [streams, setStreams] = useState<StreamInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const fetchStreams = useCallback(async () => {
    try {
      const data = await listStreams()
      setStreams(data)
    } catch {
      // silently ignore errors on refresh
    }
  }, [])

  useEffect(() => {
    fetchStreams()
    const timer = setInterval(fetchStreams, 10000)
    return () => clearInterval(timer)
  }, [fetchStreams])

  const handleStopStream = async (streamId: string) => {
    setLoading(true)
    try {
      await stopStream(streamId)
      setSnackbar({ open: true, message: '直播已结束', severity: 'success' })
      fetchStreams()
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '操作失败',
        severity: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        直播管理
      </Typography>
      {streams.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
          当前没有进行中的直播
        </Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>直播间ID</TableCell>
                <TableCell>推流者</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>码率</TableCell>
                <TableCell>开始时间</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {streams.map((stream) => (
                <TableRow key={stream.id}>
                  <TableCell>{stream.id}</TableCell>
                  <TableCell>{stream.publisher}</TableCell>
                  <TableCell>{stream.status}</TableCell>
                  <TableCell>
                    {stream.bitrate ? `${(stream.bitrate / 1024).toFixed(1)} kbps` : '-'}
                  </TableCell>
                  <TableCell>{stream.startTime}</TableCell>
                  <TableCell>
                    <Button
                      variant="contained"
                      color="error"
                      size="small"
                      startIcon={<StopIcon />}
                      onClick={() => handleStopStream(stream.id)}
                      disabled={loading}
                    >
                      结束直播
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
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
