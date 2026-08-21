import SendIcon from '@mui/icons-material/Send'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
  type ChipProps
} from '@mui/material'
import { useState, type FormEvent } from 'react'

import type { ConnectionState } from '../../hooks/useRoomChannel'
import type { DanmakuMessage, ViewerIdentity } from '../../libs/api'
import { unicodeLength } from '../../libs/viewerIdentity'
import type { DanmakuDisplaySettings } from '../../storages/player'

export interface DanmakuPanelProps {
  viewer: ViewerIdentity
  connection: ConnectionState
  messages: readonly DanmakuMessage[]
  composerError: string
  settings: DanmakuDisplaySettings
  onSettingsChange: (settings: DanmakuDisplaySettings) => void
  onSendMessage: (content: string) => boolean
}

const CONNECTION_PRESENTATION: Record<
  ConnectionState,
  { label: string; color: ChipProps['color'] }
> = {
  idle: { label: '等待连接', color: 'default' },
  connecting: { label: '连接中', color: 'info' },
  connected: { label: '已连接', color: 'success' },
  reconnecting: { label: '重连中', color: 'warning' },
  disconnected: { label: '已断开', color: 'default' }
}

export default function DanmakuPanel({
  viewer,
  connection,
  messages,
  composerError,
  settings,
  onSettingsChange,
  onSendMessage
}: DanmakuPanelProps) {
  const [content, setContent] = useState('')
  const [validationError, setValidationError] = useState('')
  const contentLength = unicodeLength(content)
  const isConnected = connection === 'connected'
  const connectionPresentation = CONNECTION_PRESENTATION[connection]
  const opacityPercent = Math.round(settings.opacity * 100)

  const updateSettings = <Key extends keyof DanmakuDisplaySettings>(
    key: Key,
    value: DanmakuDisplaySettings[Key]
  ) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedContent = content.trim()

    if (!normalizedContent) {
      setValidationError('弹幕内容不能为空')
      return
    }
    if (unicodeLength(normalizedContent) > 100) {
      setValidationError('弹幕不能超过 100 个字符')
      return
    }

    setValidationError('')
    if (onSendMessage(normalizedContent)) {
      setContent('')
    }
  }

  return (
    <Card
      sx={{
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        width: '100%'
      }}
      variant="outlined"
    >
      <CardContent
        sx={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          minHeight: 0,
          p: { xs: 2, md: 2 }
        }}
      >
        <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0 }}>
          <Box
            sx={{
              alignItems: 'center',
              display: 'flex',
              gap: 1,
              justifyContent: 'space-between',
              minWidth: 0
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h2" variant="h6">
                弹幕
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
                variant="body2"
              >
                当前身份：{viewer.name}
              </Typography>
            </Box>
            <Chip
              color={connectionPresentation.color}
              label={connectionPresentation.label}
              size="small"
              variant="outlined"
            />
          </Box>

          <Divider />

          <Box
            aria-label="弹幕设置"
            component="section"
            sx={{
              borderColor: 'divider',
              borderRadius: 1,
              borderStyle: 'solid',
              borderWidth: 1,
              p: 1.5
            }}
          >
            <Stack spacing={1.5}>
              <Box
                sx={{
                  alignItems: 'center',
                  display: 'flex',
                  gap: 1,
                  justifyContent: 'space-between'
                }}
              >
                <Typography component="h3" variant="body1">
                  弹幕设置
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.enabled}
                      onChange={(_, checked) => updateSettings('enabled', checked)}
                      size="small"
                    />
                  }
                  label="播放器弹幕"
                  labelPlacement="start"
                  sx={{ ml: 0, mr: 0 }}
                />
              </Box>

              <Box sx={{ px: 0.5 }}>
                <Box
                  sx={{
                    alignItems: 'center',
                    display: 'flex',
                    justifyContent: 'space-between',
                    mb: 0.5
                  }}
                >
                  <Typography id="danmaku-opacity-label" variant="body2">
                    弹幕透明度
                  </Typography>
                  <Typography color="text.secondary" variant="caption">
                    {opacityPercent}%
                  </Typography>
                </Box>
                <Slider
                  aria-label="弹幕透明度"
                  aria-labelledby="danmaku-opacity-label"
                  max={100}
                  min={35}
                  onChange={(_, value) => {
                    if (typeof value === 'number') {
                      updateSettings('opacity', value / 100)
                    }
                  }}
                  size="small"
                  step={5}
                  value={opacityPercent}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}%`}
                />
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row', md: 'column' }} spacing={1}>
                <FormControl fullWidth size="small">
                  <InputLabel id="danmaku-font-size-label">字号</InputLabel>
                  <Select
                    label="字号"
                    labelId="danmaku-font-size-label"
                    onChange={(event) =>
                      updateSettings(
                        'fontSize',
                        event.target.value as DanmakuDisplaySettings['fontSize']
                      )
                    }
                    value={settings.fontSize}
                  >
                    <MenuItem value="small">小</MenuItem>
                    <MenuItem value="medium">中</MenuItem>
                    <MenuItem value="large">大</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small">
                  <InputLabel id="danmaku-speed-label">速度</InputLabel>
                  <Select
                    label="速度"
                    labelId="danmaku-speed-label"
                    onChange={(event) =>
                      updateSettings('speed', event.target.value as DanmakuDisplaySettings['speed'])
                    }
                    value={settings.speed}
                  >
                    <MenuItem value="slow">慢</MenuItem>
                    <MenuItem value="normal">标准</MenuItem>
                    <MenuItem value="fast">快</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small">
                  <InputLabel id="danmaku-density-label">密度</InputLabel>
                  <Select
                    label="密度"
                    labelId="danmaku-density-label"
                    onChange={(event) =>
                      updateSettings('density', event.target.value as DanmakuDisplaySettings['density'])
                    }
                    value={settings.density}
                  >
                    <MenuItem value="low">低</MenuItem>
                    <MenuItem value="normal">标准</MenuItem>
                    <MenuItem value="high">高</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          </Box>

          <Divider />

          <Box
            aria-labelledby="recent-danmaku-heading"
            aria-relevant="additions"
            data-testid="danmaku-recent"
            role="log"
            sx={{
              flex: 1,
              minHeight: { xs: 160, md: 0 },
              maxHeight: { xs: 320, md: 'none' },
              overflowY: 'auto',
              pr: 0.5
            }}
          >
            <Typography id="recent-danmaku-heading" component="h3" sx={{ mb: 1 }} variant="body1">
              最近消息
            </Typography>
            {messages.length === 0 ? (
              <Typography color="text.secondary" variant="body2">
                暂无弹幕
              </Typography>
            ) : (
              <Stack spacing={1}>
                {messages.map((message) => (
                  <Typography
                    key={message.id}
                    component="p"
                    sx={{ m: 0, overflowWrap: 'anywhere' }}
                    variant="body2"
                  >
                    <Box component="span" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      {message.sender.name}
                    </Box>
                    {'：'}
                    {message.content}
                  </Typography>
                ))}
              </Stack>
            )}
          </Box>

          <Divider />

          <Stack
            component="form"
            data-testid="danmaku-composer"
            onSubmit={handleSubmit}
            spacing={1}
          >
            {validationError || composerError ? (
              <Alert severity="error">{validationError || composerError}</Alert>
            ) : null}
            <TextField
              disabled={!isConnected}
              fullWidth
              label="发送弹幕"
              onChange={(event) => {
                setContent(event.target.value)
                setValidationError('')
              }}
              placeholder={isConnected ? '输入弹幕内容' : '连接后可发送弹幕'}
              value={content}
            />
            <Box
              sx={{
                alignItems: 'center',
                display: 'flex',
                gap: 1,
                justifyContent: 'space-between'
              }}
            >
              <Typography
                color={contentLength > 100 ? 'error.main' : 'text.secondary'}
                variant="caption"
              >
                {contentLength}/100
              </Typography>
              <Button
                disabled={!isConnected}
                endIcon={<SendIcon />}
                type="submit"
                variant="contained"
              >
                发送
              </Button>
            </Box>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
