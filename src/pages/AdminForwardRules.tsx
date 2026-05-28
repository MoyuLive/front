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
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
  Chip,
  Tooltip
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'

import { listForwardRules, addForwardRule, deleteForwardRule, ForwardRule } from '../libs/api'

export default function AdminForwardRules() {
  const [rules, setRules] = useState<ForwardRule[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [streamFilter, setStreamFilter] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listForwardRules()
      setRules(data)
    } catch (err) {
      console.error('Failed to fetch forward rules:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const handleAdd = async () => {
    if (!streamFilter.trim() || !targetUrl.trim()) {
      setSnackbar({ open: true, message: '流过滤器和目标URL不能为空', severity: 'error' })
      return
    }
    setAdding(true)
    try {
      await addForwardRule(streamFilter.trim(), targetUrl.trim())
      setSnackbar({ open: true, message: '转发规则已添加', severity: 'success' })
      setStreamFilter('')
      setTargetUrl('')
      fetchRules()
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '添加失败',
        severity: 'error'
      })
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeleting(id)
    try {
      await deleteForwardRule(id)
      setSnackbar({ open: true, message: '转发规则已删除', severity: 'success' })
      fetchRules()
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '删除失败',
        severity: 'error'
      })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        转发管理
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField
            label="流过滤器"
            size="small"
            value={streamFilter}
            onChange={(e) => setStreamFilter(e.target.value)}
            placeholder="* 或 live/room123"
            sx={{ minWidth: 200 }}
          />
          <TextField
            label="目标URL"
            size="small"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="rtmp://xxx:1935/live/stream"
            sx={{ minWidth: 280, flexGrow: 1 }}
          />
          <Button
            variant="contained"
            startIcon={adding ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
            onClick={handleAdd}
            disabled={adding}
          >
            添加
          </Button>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : rules.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
          暂无转发规则
        </Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>流过滤器</TableCell>
                <TableCell>目标URL</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>创建时间</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>{rule.id}</TableCell>
                  <TableCell>
                    <Chip label={rule.stream_filter} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={rule.target_url}>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 300,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {rule.target_url}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={rule.enabled ? '启用' : '禁用'}
                      size="small"
                      color={rule.enabled ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{rule.created_at}</TableCell>
                  <TableCell>
                    <Button
                      variant="contained"
                      color="error"
                      size="small"
                      startIcon={
                        deleting === rule.id ? (
                          <CircularProgress size={18} color="inherit" />
                        ) : (
                          <DeleteIcon />
                        )
                      }
                      onClick={() => handleDelete(rule.id)}
                      disabled={deleting !== null}
                    >
                      删除
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
