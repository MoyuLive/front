import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import KeyIcon from '@mui/icons-material/Key'
import StopIcon from '@mui/icons-material/Stop'

import {
  AdminRoom,
  AdminUser,
  createAdminRoom,
  deleteAdminRoom,
  listAdminRooms,
  listAdminUsers,
  resetAdminRoomStreamCode,
  stopAdminStream,
  updateAdminRoom
} from '../libs/api'
import { buildRtmpStreamKey } from '../libs/streamUrls'

interface AdminRoomsProps {
  isSuperAdmin: boolean
}

interface RoomForm {
  user_id: number
  stream_id: string
  title: string
  enabled: boolean
}

const emptyForm: RoomForm = {
  user_id: 0,
  stream_id: '',
  title: '',
  enabled: true
}

export default function AdminRooms({ isSuperAdmin }: AdminRoomsProps) {
  const [rooms, setRooms] = useState<AdminRoom[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminRoom | null>(null)
  const [form, setForm] = useState<RoomForm>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<AdminRoom | null>(null)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const fetchRooms = useCallback(async () => {
    try {
      setRooms(await listAdminRooms())
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '获取直播间列表失败',
        severity: 'error'
      })
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    if (!isSuperAdmin) return
    try {
      setUsers(await listAdminUsers())
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '获取用户列表失败',
        severity: 'error'
      })
    }
  }, [isSuperAdmin])

  useEffect(() => {
    fetchRooms()
    fetchUsers()
    const timer = setInterval(fetchRooms, 10000)
    return () => clearInterval(timer)
  }, [fetchRooms, fetchUsers])

  const sortedRooms = useMemo(
    () =>
      [...rooms].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'live' ? -1 : 1
        return a.stream_id.localeCompare(b.stream_id)
      }),
    [rooms]
  )

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, user_id: users[0]?.id ?? 0 })
    setDialogOpen(true)
  }

  const openEdit = (room: AdminRoom) => {
    setEditing(room)
    setForm({
      user_id: room.user_id,
      stream_id: room.stream_id,
      title: room.title,
      enabled: room.enabled
    })
    setDialogOpen(true)
  }

  const saveRoom = async () => {
    setLoading(true)
    try {
      if (editing) {
        const params = isSuperAdmin
          ? form
          : {
              title: form.title
            }
        await updateAdminRoom(editing.id, params)
        setSnackbar({ open: true, message: '直播间已更新', severity: 'success' })
      } else {
        await createAdminRoom(form)
        setSnackbar({ open: true, message: '直播间已创建', severity: 'success' })
      }
      setDialogOpen(false)
      await fetchRooms()
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '保存失败',
        severity: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  const resetCode = async (room: AdminRoom) => {
    setLoading(true)
    try {
      const updated = await resetAdminRoomStreamCode(room.id)
      setRooms((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setSnackbar({ open: true, message: '推流链接已重置', severity: 'success' })
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

  const stopStream = async (room: AdminRoom) => {
    setLoading(true)
    try {
      await stopAdminStream(room.stream_id)
      setSnackbar({ open: true, message: '直播已中断', severity: 'success' })
      await fetchRooms()
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '中断失败',
        severity: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  const copyStreamKey = async (room: AdminRoom) => {
    await navigator.clipboard.writeText(buildRtmpStreamKey(room.stream_id, room.stream_code))
    setSnackbar({ open: true, message: '推流码已复制', severity: 'success' })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setLoading(true)
    try {
      await deleteAdminRoom(deleteTarget.id)
      setSnackbar({ open: true, message: '直播间已删除', severity: 'success' })
      setDeleteTarget(null)
      await fetchRooms()
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '删除失败',
        severity: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">直播间管理</Typography>
        {isSuperAdmin ? (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
            disabled={users.length === 0}
          >
            新增直播间
          </Button>
        ) : null}
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>直播间ID</TableCell>
              <TableCell>标题</TableCell>
              <TableCell>用户</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>推流码</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRooms.map((room) => (
              <TableRow key={room.id}>
                <TableCell>{room.stream_id}</TableCell>
                <TableCell>{room.title || '-'}</TableCell>
                <TableCell>{room.username || room.user_id}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={room.status === 'live' ? 'success' : 'default'}
                    label={room.status === 'live' ? '直播中' : room.enabled ? '离线' : '停用'}
                  />
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{room.stream_code}</TableCell>
                <TableCell align="right">
                  <Tooltip title="复制OBS串流密钥">
                    <IconButton onClick={() => copyStreamKey(room)}>
                      <ContentCopyIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="编辑">
                    <IconButton onClick={() => openEdit(room)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="重置推流链接">
                    <IconButton onClick={() => resetCode(room)} disabled={loading}>
                      <KeyIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="中断直播">
                    <span>
                      <IconButton
                        color="error"
                        onClick={() => stopStream(room)}
                        disabled={loading || room.status !== 'live'}
                      >
                        <StopIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {isSuperAdmin ? (
                    <Tooltip title="删除">
                      <IconButton color="error" onClick={() => setDeleteTarget(room)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? '编辑直播间' : '新增直播间'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          {isSuperAdmin ? (
            <FormControl fullWidth>
              <InputLabel>用户</InputLabel>
              <Select
                value={form.user_id || ''}
                label="用户"
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, user_id: Number(e.target.value) }))
                }
              >
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.username}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
          <TextField
            label="直播间ID"
            value={form.stream_id}
            onChange={(e) => setForm((prev) => ({ ...prev, stream_id: e.target.value }))}
            disabled={!isSuperAdmin}
            fullWidth
          />
          <TextField
            label="标题"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            fullWidth
          />
          {isSuperAdmin ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch
                checked={form.enabled}
                onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              <Typography>{form.enabled ? '启用' : '停用'}</Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={saveRoom} disabled={loading}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>删除直播间</DialogTitle>
        <DialogContent>
          <Typography>{deleteTarget?.stream_id}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={loading}>
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
