import { useEffect, useState, type FormEvent } from 'react'
import {
  Alert,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'

import type { RoomPrivacyInput } from '../../libs/api'
import { unicodeLength } from '../../libs/viewerIdentity'

export interface PrivacyControlsProps {
  requireLogin: boolean
  hasPassword: boolean
  onSave: (input: RoomPrivacyInput) => void | Promise<void>
  loading?: boolean
  error?: string
}

export default function PrivacyControls({
  requireLogin,
  hasPassword,
  onSave,
  loading = false,
  error = ''
}: PrivacyControlsProps) {
  const [nextRequireLogin, setNextRequireLogin] = useState(requireLogin)
  const [passwordEnabled, setPasswordEnabled] = useState(hasPassword)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    setNextRequireLogin(requireLogin)
    setPasswordEnabled(hasPassword)
    setPassword('')
    setSaveError('')
  }, [hasPassword, requireLogin])

  const passwordLength = unicodeLength(password)
  const needsNewPassword = passwordEnabled && !hasPassword
  const passwordIsInvalid = passwordEnabled && (
    (needsNewPassword && passwordLength === 0) ||
    (passwordLength > 0 && (passwordLength < 6 || passwordLength > 64))
  )
  const passwordHelperText = passwordIsInvalid
    ? '开启密码保护时，密码必须为 6-64 个字符'
    : hasPassword && passwordLength === 0
      ? '留空保持当前密码'
      : `${passwordLength}/64 个字符，支持 Unicode`
  const busy = loading || saving

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || passwordIsInvalid) return

    const input: RoomPrivacyInput = {
      require_login: nextRequireLogin,
      password_enabled: passwordEnabled
    }
    if (passwordEnabled && password) {
      input.password = password
    }

    setSaving(true)
    setSaveError('')
    try {
      await onSave(input)
      setPassword('')
    } catch (saveFailure) {
      setSaveError(saveFailure instanceof Error ? saveFailure.message : '保存隐私设置失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack component="form" onSubmit={handleSubmit} spacing={2}>
      {error || saveError ? <Alert severity="error">{error || saveError}</Alert> : null}

      <Stack divider={<Divider flexItem />} spacing={1}>
        <FormControlLabel
          control={(
            <Switch
              checked={nextRequireLogin}
              disabled={busy}
              onChange={(event) => setNextRequireLogin(event.target.checked)}
            />
          )}
          label={(
            <Stack spacing={0.5}>
              <Typography variant="body1">要求账号登录</Typography>
              <Typography color="text.secondary" variant="body2">
                开启后，仅已登录账号可以申请播放凭证。
              </Typography>
            </Stack>
          )}
          sx={{ alignItems: 'flex-start', m: 0, py: 1 }}
        />

        <FormControlLabel
          control={(
            <Switch
              checked={passwordEnabled}
              disabled={busy}
              onChange={(event) => {
                setPasswordEnabled(event.target.checked)
                setSaveError('')
                if (!event.target.checked) setPassword('')
              }}
            />
          )}
          label={(
            <Stack spacing={0.5}>
              <Typography variant="body1">启用房间密码</Typography>
              <Typography color="text.secondary" variant="body2">
                密码只用于本次保存，不会在界面中读取或显示。
              </Typography>
            </Stack>
          )}
          sx={{ alignItems: 'flex-start', m: 0, py: 1 }}
        />
      </Stack>

      {passwordEnabled ? (
        <TextField
          autoComplete="new-password"
          disabled={busy}
          error={passwordIsInvalid}
          fullWidth
          helperText={passwordHelperText}
          label="新房间密码"
          onChange={(event) => {
            setPassword(event.target.value)
            setSaveError('')
          }}
          type="password"
          value={password}
        />
      ) : null}

      <Button
        disabled={busy || passwordIsInvalid}
        startIcon={busy ? <CircularProgress color="inherit" size={18} /> : <SaveIcon />}
        sx={{ alignSelf: 'flex-start' }}
        type="submit"
        variant="contained"
      >
        {busy ? '保存中...' : '保存隐私设置'}
      </Button>
    </Stack>
  )
}
