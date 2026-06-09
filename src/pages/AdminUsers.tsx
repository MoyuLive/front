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
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'

import {
  AdminUser,
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser
} from '../libs/api'
import { UserRole } from '../libs/auth'

const roleLabels: Record<UserRole, string> = {
  user: '用户',
  admin: '管理员',
  super_admin: '超级管理员'
}

const emptyForm = {
  username: '',
  password: '',
  role: 'user' as UserRole,
  enabled: true
}

type UserForm = typeof emptyForm

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const fetchUsers = useCallback(async () => {
    try {
      setUsers(await listAdminUsers())
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '获取用户列表失败',
        severity: 'error'
      })
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) => {
        if (a.role !== b.role) return a.role.localeCompare(b.role)
        return a.id - b.id
      }),
    [users]
  )

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (user: AdminUser) => {
    setEditing(user)
    setForm({
      username: user.username,
      password: '',
      role: user.role,
      enabled: user.enabled
    })
    setDialogOpen(true)
  }

  const saveUser = async () => {
    setLoading(true)
    try {
      if (editing) {
        await updateAdminUser(editing.id, {
          username: form.username,
          password: form.password || undefined,
          role: form.role,
          enabled: form.enabled
        })
        setSnackbar({ open: true, message: '用户已更新', severity: 'success' })
      } else {
        await createAdminUser(form)
        setSnackbar({ open: true, message: '用户已创建', severity: 'success' })
      }
      setDialogOpen(false)
      await fetchUsers()
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

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setLoading(true)
    try {
      await deleteAdminUser(deleteTarget.id)
      setSnackbar({ open: true, message: '用户已删除', severity: 'success' })
      setDeleteTarget(null)
      await fetchUsers()
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
        <Typography variant="h5">用户管理</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          新增用户
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>用户名</TableCell>
              <TableCell>角色</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>直播间数</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.id}</TableCell>
                <TableCell>{user.username}</TableCell>
                <TableCell>
                  <Chip size="small" label={roleLabels[user.role]} />
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={user.enabled ? 'success' : 'default'}
                    label={user.enabled ? '启用' : '停用'}
                  />
                </TableCell>
                <TableCell>{user.room_count}</TableCell>
                <TableCell align="right">
                  <Tooltip title="编辑">
                    <IconButton onClick={() => openEdit(user)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="删除">
                    <IconButton color="error" onClick={() => setDeleteTarget(user)}>
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? '编辑用户' : '新增用户'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <TextField
            label="用户名"
            value={form.username}
            onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
            fullWidth
          />
          <TextField
            label={editing ? '新密码' : '密码'}
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            type="password"
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>角色</InputLabel>
            <Select
              value={form.role}
              label="角色"
              onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}
            >
              <MenuItem value="user">用户</MenuItem>
              <MenuItem value="admin">管理员</MenuItem>
              <MenuItem value="super_admin">超级管理员</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Switch
              checked={form.enabled}
              onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            <Typography>{form.enabled ? '启用' : '停用'}</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={saveUser} disabled={loading}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>删除用户</DialogTitle>
        <DialogContent>
          <Typography>{deleteTarget?.username}</Typography>
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
