import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
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
import ImageIcon from '@mui/icons-material/Image'
import KeyIcon from '@mui/icons-material/Key'
import StopIcon from '@mui/icons-material/Stop'
import UploadIcon from '@mui/icons-material/Upload'

import {
  AdminRoom,
  AdminUser,
  createAdminRoom,
  deleteAdminRoom,
  listAdminRooms,
  listAdminUsers,
  resetAdminRoomStreamCode,
  resolveApiAssetUrl,
  stopAdminStream,
  updateAdminRoom,
  updateLiveRoomCover
} from '../libs/api'
import { buildRtmpStreamKey } from '../libs/streamUrls'
import { unicodeLength } from '../libs/viewerIdentity'

interface AdminRoomsProps {
  isSuperAdmin: boolean
}

interface RoomForm {
  user_id: number
  stream_id: string
  title: string
  enabled: boolean
  require_login: boolean
  password_enabled: boolean
  password: string
}

const emptyForm: RoomForm = {
  user_id: 0,
  stream_id: '',
  title: '',
  enabled: true,
  require_login: false,
  password_enabled: false,
  password: ''
}

export default function AdminRooms({ isSuperAdmin }: AdminRoomsProps) {
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [rooms, setRooms] = useState<AdminRoom[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminRoom | null>(null)
  const [form, setForm] = useState<RoomForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [coverTarget, setCoverTarget] = useState<AdminRoom | null>(null)
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
  const passwordLength = unicodeLength(form.password)
  const passwordRequired = form.password_enabled && !editing?.has_password
  const passwordValidationError = form.password_enabled && (
    (passwordRequired && passwordLength === 0) ||
    (passwordLength > 0 && (passwordLength < 6 || passwordLength > 64))
  )
    ? '启用房间密码时，密码必须为 6-64 个字符'
    : ''

  const closeRoomDialog = () => {
    setDialogOpen(false)
    setForm((current) => ({ ...current, password: '' }))
    setFormError('')
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, user_id: users[0]?.id ?? 0 })
    setFormError('')
    setDialogOpen(true)
  }

  const openEdit = (room: AdminRoom) => {
    setEditing(room)
    setForm({
      user_id: room.user_id,
      stream_id: room.stream_id,
      title: room.title,
      enabled: room.enabled,
      require_login: room.require_login,
      password_enabled: room.has_password,
      password: ''
    })
    setFormError('')
    setDialogOpen(true)
  }

  const saveRoom = async () => {
    if (passwordValidationError) {
      setFormError(passwordValidationError)
      return
    }
    if (!editing && !isSuperAdmin) {
      setFormError('只有超级管理员可以创建直播间')
      return
    }

    setLoading(true)
    setFormError('')
    try {
      const privacyParams = {
        require_login: form.require_login,
        password_enabled: form.password_enabled,
        ...(form.password ? { password: form.password } : {})
      }
      if (editing) {
        const params = isSuperAdmin
          ? {
              user_id: form.user_id,
              stream_id: form.stream_id,
              title: form.title,
              enabled: form.enabled,
              ...privacyParams
            }
          : {
              title: form.title,
              ...privacyParams
            }
        await updateAdminRoom(editing.id, params)
        setSnackbar({ open: true, message: '直播间已更新', severity: 'success' })
      } else {
        await createAdminRoom({
          user_id: form.user_id,
          stream_id: form.stream_id,
          title: form.title,
          enabled: form.enabled,
          ...privacyParams
        })
        setSnackbar({ open: true, message: '直播间已创建', severity: 'success' })
      }
      closeRoomDialog()
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

  const openCoverUpload = (room: AdminRoom) => {
    setCoverTarget(room)
    coverInputRef.current?.click()
  }

  const handleCoverFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    const target = coverTarget
    setCoverTarget(null)
    if (!file || !target) return

    if (!file.type.startsWith('image/')) {
      setSnackbar({ open: true, message: '请选择图片文件', severity: 'error' })
      return
    }

    setLoading(true)
    try {
      const updated = await updateLiveRoomCover(target.id, file)
      setRooms((prev) =>
        prev.map((room) =>
          room.id === target.id ? { ...room, cover_url: updated.cover_url } : room
        )
      )
      setSnackbar({ open: true, message: '封面已更新', severity: 'success' })
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '上传封面失败',
        severity: 'error'
      })
    } finally {
      setLoading(false)
    }
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

      <input
        ref={coverInputRef}
        accept="image/jpeg,image/png,image/webp"
        hidden
        type="file"
        onChange={handleCoverFileChange}
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>直播间ID</TableCell>
              <TableCell>封面</TableCell>
              <TableCell>标题</TableCell>
              <TableCell>用户</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>推流码</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRooms.map((room) => {
              const coverUrl = resolveApiAssetUrl(room.cover_url)

              return (
                <TableRow key={room.id}>
                  <TableCell>{room.stream_id}</TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        alignItems: 'center',
                        bgcolor: '#111',
                        borderRadius: 1,
                        color: 'rgba(255,255,255,0.56)',
                        display: 'flex',
                        height: 45,
                        justifyContent: 'center',
                        overflow: 'hidden',
                        width: 80
                      }}
                    >
                      {coverUrl ? (
                        <Box
                          alt=""
                          component="img"
                          src={coverUrl}
                          sx={{ height: '100%', objectFit: 'cover', width: '100%' }}
                        />
                      ) : (
                        <ImageIcon fontSize="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{room.title || '-'}</TableCell>
                  <TableCell>{room.username || room.user_id}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <Chip
                        size="small"
                        color={room.status === 'live' ? 'success' : 'default'}
                        label={room.status === 'live' ? '直播中' : room.enabled ? '离线' : '停用'}
                      />
                      <Chip
                        color={room.require_login ? 'warning' : 'default'}
                        label={room.require_login ? '需登录' : '无需登录'}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        color={room.has_password ? 'warning' : 'default'}
                        label={room.has_password ? '需密码' : '无密码'}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{room.stream_code}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="上传封面">
                      <IconButton onClick={() => openCoverUpload(room)} disabled={loading}>
                        <UploadIcon />
                      </IconButton>
                    </Tooltip>
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
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={closeRoomDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? '编辑直播间' : '新增直播间'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, minWidth: 0, pt: 2 }}>
          {formError ? <Alert severity="error">{formError}</Alert> : null}
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
            <FormControlLabel
              control={(
                <Switch
                  checked={form.enabled}
                  onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
              )}
              label={form.enabled ? '直播间已启用' : '直播间已停用'}
            />
          ) : null}

          <Box
            component="fieldset"
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, m: 0, minWidth: 0, p: 2 }}
          >
            <Typography component="legend" sx={{ px: 1 }} variant="subtitle2">
              隐私设置
            </Typography>
            <Stack spacing={1.5} sx={{ minWidth: 0 }}>
              <FormControlLabel
                control={(
                  <Switch
                    checked={form.require_login}
                    disabled={loading}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      require_login: event.target.checked
                    }))}
                  />
                )}
                label="要求账号登录"
                sx={{ m: 0 }}
              />
              <FormControlLabel
                control={(
                  <Switch
                    checked={form.password_enabled}
                    disabled={loading}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        password_enabled: event.target.checked,
                        password: event.target.checked ? current.password : ''
                      }))
                      setFormError('')
                    }}
                  />
                )}
                label="启用房间密码"
                sx={{ m: 0 }}
              />
              {form.password_enabled ? (
                <TextField
                  autoComplete="new-password"
                  disabled={loading}
                  error={Boolean(passwordValidationError)}
                  fullWidth
                  helperText={
                    passwordValidationError || (editing?.has_password && passwordLength === 0
                      ? '密码已配置；留空保持当前密码'
                      : `${passwordLength}/64 个字符，支持 Unicode`)
                  }
                  label="房间密码"
                  onChange={(event) => {
                    setForm((current) => ({ ...current, password: event.target.value }))
                    setFormError('')
                  }}
                  type="password"
                  value={form.password}
                />
              ) : null}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', px: { xs: 2, sm: 3 }, pb: 2 }}>
          <Button onClick={closeRoomDialog}>取消</Button>
          <Button
            variant="contained"
            onClick={saveRoom}
            disabled={loading || Boolean(passwordValidationError)}
          >
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
