import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip
} from '@mui/material'
import { getServerStatus, ServerStatus } from '../libs/api'

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}天 ${h}小时`
  if (h > 0) return `${h}小时 ${m}分`
  return `${m}分钟`
}

export default function AdminSystem() {
  const [servers, setServers] = useState<ServerStatus[]>([])
  const [error, setError] = useState('')

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getServerStatus()
      setServers(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取服务器状态失败')
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const timer = setInterval(fetchStatus, 10000)
    return () => clearInterval(timer)
  }, [fetchStatus])

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        系统状态
      </Typography>
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      <Grid container spacing={3}>
        {servers.map((server) => (
          <Grid item xs={12} sm={6} md={4} key={server.device_id}>
            <Card>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2
                  }}
                >
                  <Typography variant="h6">{server.ip || server.device_id}</Typography>
                  <Chip label="活跃" color="success" size="small" />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  CPU 使用率: {server.cpu_usage.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  内存: {server.mem_usage.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  运行时间: {formatUptime(server.uptime_seconds)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  最后心跳: {server.last_heartbeat}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
        {servers.length === 0 && !error && (
          <Grid item xs={12}>
            <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
              暂无服务器数据
            </Typography>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}
