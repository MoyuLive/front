import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LoginIcon from '@mui/icons-material/Login'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { useState, type FormEvent } from 'react'
import { Link as RouterLink } from 'react-router-dom'

import type { AccessState } from '../../hooks/useRoomChannel'
import { unicodeLength } from '../../libs/viewerIdentity'

export interface RoomAccessGateProps {
  accessState: AccessState
  roomId: string
  isSubmittingPassword: boolean
  onRetry: () => void
  onSubmitPassword: (password: string) => Promise<void>
}

export default function RoomAccessGate({
  accessState,
  roomId,
  isSubmittingPassword,
  onRetry,
  onSubmitPassword
}: RoomAccessGateProps) {
  const [password, setPassword] = useState('')
  const [validationError, setValidationError] = useState('')
  const passwordLength = unicodeLength(password)

  if (accessState.kind === 'ready') return null

  const redirectPath = `/live/${encodeURIComponent(roomId)}`
  const loginUrl = `/login?redirect=${encodeURIComponent(redirectPath)}`

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmittingPassword) return

    if (passwordLength < 6 || passwordLength > 64) {
      setValidationError('房间密码必须为 6-64 个字符')
      return
    }

    setValidationError('')
    await onSubmitPassword(password)
    setPassword('')
  }

  return (
    <Card
      data-testid="room-access-gate"
      sx={{ borderColor: 'divider', mx: 'auto', width: '100%', maxWidth: 480 }}
      variant="outlined"
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        {accessState.kind === 'loading' ? (
          <Stack
            alignItems="center"
            aria-live="polite"
            role="status"
            spacing={2}
            sx={{ py: { xs: 4, sm: 6 } }}
          >
            <CircularProgress size={32} />
            <Typography color="text.secondary">正在确认直播间访问权限</Typography>
          </Stack>
        ) : null}

        {accessState.kind === 'login_required' ? (
          <Stack spacing={2}>
            <Box>
              <Typography component="h1" gutterBottom variant="h6">
                需要登录
              </Typography>
              <Alert severity="warning">{accessState.message}</Alert>
            </Box>
            <Button
              component={RouterLink}
              startIcon={<LoginIcon />}
              to={loginUrl}
              variant="contained"
            >
              登录并返回房间
            </Button>
          </Stack>
        ) : null}

        {accessState.kind === 'password_required' ? (
          <Stack component="form" onSubmit={handlePasswordSubmit} spacing={2}>
            <Box>
              <Typography component="h1" gutterBottom variant="h6">
                房间密码
              </Typography>
              <Alert
                severity={accessState.message === '请输入房间密码' ? 'info' : 'error'}
              >
                {accessState.message}
              </Alert>
            </Box>
            {validationError ? <Alert severity="error">{validationError}</Alert> : null}
            <TextField
              autoComplete="off"
              autoFocus
              disabled={isSubmittingPassword}
              fullWidth
              helperText={`${passwordLength}/64 个字符，支持 Unicode`}
              label="房间密码"
              onChange={(event) => {
                setPassword(event.target.value)
                setValidationError('')
              }}
              required
              type="password"
              value={password}
            />
            <Button
              disabled={isSubmittingPassword}
              startIcon={<LockOutlinedIcon />}
              type="submit"
              variant="contained"
            >
              {isSubmittingPassword ? '验证中...' : '进入直播间'}
            </Button>
          </Stack>
        ) : null}

        {accessState.kind === 'error' ? (
          <Stack spacing={2}>
            <Typography component="h1" variant="h6">
              无法进入直播间
            </Typography>
            <Alert severity="error">{accessState.message}</Alert>
            <Button onClick={onRetry} variant="contained">
              重试
            </Button>
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  )
}
