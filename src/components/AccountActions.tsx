import { useState } from 'react'
import { Button, Stack, Typography } from '@mui/material'
import { Link as RouterLink, useNavigate } from 'react-router-dom'

import { logout } from '../libs/api'
import { clearToken, decodeToken, isAdminRole } from '../libs/auth'

export default function AccountActions() {
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const account = decodeToken()

  const handleLogout = async () => {
    if (loggingOut) return

    setLoggingOut(true)
    try {
      await logout()
    } catch {
      // Local sign-out must still complete when the server is unavailable.
    } finally {
      clearToken()
      setLoggingOut(false)
      navigate('/')
    }
  }

  if (!account) {
    return (
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Button component={RouterLink} size="small" to="/login" variant="outlined">
          登录
        </Button>
        <Button component={RouterLink} size="small" to="/login?mode=register" variant="contained">
          注册
        </Button>
      </Stack>
    )
  }

  return (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      sx={{ alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}
    >
      <Typography sx={{ maxWidth: '100%', overflowWrap: 'anywhere' }} variant="body2">
        {account.username}
      </Typography>
      <Button component={RouterLink} size="small" to="/admin" variant="outlined">
        {isAdminRole(account.role) ? '管理后台' : '推流管理'}
      </Button>
      <Button disabled={loggingOut} onClick={handleLogout} size="small" variant="text">
        {loggingOut ? '退出中...' : '退出'}
      </Button>
    </Stack>
  )
}
