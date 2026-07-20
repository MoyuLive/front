import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material'

import { login, register } from '../libs/api'
import { accountValidationError, sanitizeRedirect } from '../libs/viewerIdentity'

type AccountMode = 'login' | 'register'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<AccountMode>(
    searchParams.get('mode') === 'register' ? 'register' : 'login'
  )
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleModeChange = (_event: React.SyntheticEvent, nextMode: AccountMode) => {
    setMode(nextMode)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const validationError = accountValidationError(username, password)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const accountRequest = mode === 'login' ? login : register
      const result = await accountRequest({ username, password })
      localStorage.setItem('jwt', result.token)
      navigate(sanitizeRedirect(searchParams.get('redirect')))
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'login' ? '登录失败' : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100dvh',
          py: 3
        }}
      >
        <Card sx={{ width: '100%', maxWidth: 400 }} variant="outlined">
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography component="h1" sx={{ mb: 2, textAlign: 'center' }} variant="h5">
              Yantube 账号
            </Typography>
            <Tabs
              aria-label="账号操作"
              onChange={handleModeChange}
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
              value={mode}
              variant="fullWidth"
            >
              <Tab disabled={loading} label="登录" value="login" />
              <Tab disabled={loading} label="注册" value="register" />
            </Tabs>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                label="用户名"
                variant="outlined"
                fullWidth
                margin="normal"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
              />
              <TextField
                label="密码"
                type="password"
                variant="outlined"
                fullWidth
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                sx={{ mt: 3 }}
              >
                {loading ? (mode === 'login' ? '登录中...' : '注册中...') : mode === 'login' ? '登录' : '注册'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  )
}
