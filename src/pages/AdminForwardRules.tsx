import { useState, useEffect, useCallback } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'

import {
  addForwardRule,
  deleteForwardRule,
  ForwardRule,
  listForwardRules,
  updateForwardRule
} from '../libs/api'

export default function AdminForwardRules() {
  const [rules, setRules] = useState<ForwardRule[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [savingRuleId, setSavingRuleId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ForwardRule | null>(null)
  const [loadError, setLoadError] = useState('')
  const [streamFilter, setStreamFilter] = useState('*')
  const [targetUrl, setTargetUrl] = useState('')
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const fetchRules = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await listForwardRules()
      setRules(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取转发规则失败'
      setLoadError(message)
      setSnackbar({ open: true, message, severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const handleAdd = async () => {
    const nextFilter = streamFilter.trim()
    const nextUrl = targetUrl.trim()
    if (!nextFilter || !nextUrl) {
      setSnackbar({ open: true, message: '流过滤器和目标URL不能为空', severity: 'error' })
      return
    }
    if (
      rules.some((rule) => rule.stream_filter === nextFilter && rule.target_url === nextUrl)
    ) {
      setSnackbar({ open: true, message: '相同转发规则已存在', severity: 'error' })
      return
    }

    setAdding(true)
    try {
      const created = await addForwardRule(nextFilter, nextUrl)
      setRules((prev) => [...prev, created].sort((a, b) => a.id - b.id))
      setSnackbar({ open: true, message: '转发规则已添加', severity: 'success' })
      setStreamFilter('*')
      setTargetUrl('')
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

  const handleToggle = async (rule: ForwardRule) => {
    setSavingRuleId(rule.id)
    try {
      const updated = await updateForwardRule(rule.id, { enabled: !rule.enabled })
      setRules((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setSnackbar({
        open: true,
        message: updated.enabled ? '转发规则已启用' : '转发规则已禁用',
        severity: 'success'
      })
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '更新失败',
        severity: 'error'
      })
    } finally {
      setSavingRuleId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      await deleteForwardRule(deleteTarget.id)
      setRules((prev) => prev.filter((rule) => rule.id !== deleteTarget.id))
      setSnackbar({ open: true, message: '转发规则已删除', severity: 'success' })
      setDeleteTarget(null)
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '删除失败',
        severity: 'error'
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        转发管理
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        SRS 在建立转发时读取规则；已在播的流需要重新推流才会应用新增目标。
      </Alert>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField
            label="流过滤器"
            size="small"
            value={streamFilter}
            onChange={(e) => setStreamFilter(e.target.value)}
            placeholder="* / live/* / live/room123"
            helperText="支持 *、stream、app/*、app/stream"
            sx={{ width: 260 }}
          />
          <TextField
            label="目标URL"
            size="small"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="rtmp://cdn.example.com/{app}/{stream}"
            helperText="RTMP 目标，可使用 {app} 和 {stream}"
            sx={{ minWidth: 320, flexGrow: 1 }}
          />
          <Button
            variant="contained"
            startIcon={adding ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
            onClick={handleAdd}
            disabled={adding}
            sx={{ height: 40 }}
          >
            添加
          </Button>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : loadError ? (
        <Alert severity="error" action={<Button onClick={fetchRules}>重试</Button>}>
          {loadError}
        </Alert>
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
                <TableCell align="right">操作</TableCell>
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
                          maxWidth: 360,
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Switch
                        checked={rule.enabled}
                        size="small"
                        onChange={() => handleToggle(rule)}
                        disabled={savingRuleId !== null}
                      />
                      {savingRuleId === rule.id ? (
                        <CircularProgress size={18} />
                      ) : (
                        <Chip
                          label={rule.enabled ? '启用' : '禁用'}
                          size="small"
                          color={rule.enabled ? 'success' : 'default'}
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{rule.created_at}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="删除">
                      <span>
                        <IconButton
                          color="error"
                          size="small"
                          onClick={() => setDeleteTarget(rule)}
                          disabled={deleting || savingRuleId !== null}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>删除转发规则</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {deleteTarget?.stream_filter}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
            {deleteTarget?.target_url}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            取消
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />}
          >
            删除
          </Button>
        </DialogActions>
      </Dialog>

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
