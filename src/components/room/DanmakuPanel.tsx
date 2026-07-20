import SendIcon from '@mui/icons-material/Send'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography,
  type ChipProps
} from '@mui/material'
import { useState, type FormEvent } from 'react'

import type { ConnectionState } from '../../hooks/useRoomChannel'
import type { DanmakuMessage, ViewerIdentity } from '../../libs/api'
import { unicodeLength } from '../../libs/viewerIdentity'

export interface DanmakuPanelProps {
  viewer: ViewerIdentity
  connection: ConnectionState
  messages: readonly DanmakuMessage[]
  composerError: string
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
  onSendMessage
}: DanmakuPanelProps) {
  const [content, setContent] = useState('')
  const [validationError, setValidationError] = useState('')
  const contentLength = unicodeLength(content)
  const isConnected = connection === 'connected'
  const connectionPresentation = CONNECTION_PRESENTATION[connection]

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
