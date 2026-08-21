import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import RssFeedIcon from '@mui/icons-material/RssFeed'
import { Box, Button, Chip, Container, Stack, Typography } from '@mui/material'
import { useAtom } from 'jotai'
import { Link as RouterLink, useParams } from 'react-router-dom'

import AccountActions from '../components/AccountActions'
import MoyuPlayer from '../components/player/MoyuPlayer'
import DanmakuPanel from '../components/room/DanmakuPanel'
import RoomAccessGate from '../components/room/RoomAccessGate'
import { useRoomChannel } from '../hooks/useRoomChannel'
import { danmakuDisplaySettingsAtom, danmakuPanelCollapsedAtom } from '../storages/player'

export default function Room() {
  const { roomId = '' } = useParams()
  const roomFeedUrl = roomId
    ? `/feeds/live/${encodeURIComponent(roomId)}`
    : '/feeds/live.xml'
  const roomChannel = useRoomChannel(roomId)
  const { accessState, metadata } = roomChannel
  const isReady = accessState.kind === 'ready' && metadata !== null
  const [danmakuSettings, setDanmakuSettings] = useAtom(danmakuDisplaySettingsAtom)
  const [isDanmakuPanelCollapsed, setIsDanmakuPanelCollapsed] = useAtom(
    danmakuPanelCollapsedAtom
  )

  return (
    <Container
      maxWidth="xl"
      sx={{
        minHeight: '100dvh',
        minWidth: 0,
        px: { xs: 1, sm: 2, md: 3 },
        py: { xs: 1, sm: 2, md: 3 },
        width: '100%'
      }}
    >
      <Stack spacing={{ xs: 2, md: 3 }} sx={{ minWidth: 0, width: '100%' }}>
        <Box
          component="header"
          sx={{
            alignItems: { xs: 'flex-start', sm: 'center' },
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.5,
            justifyContent: 'space-between',
            minWidth: 0,
            width: '100%'
          }}
        >
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Button
              color="inherit"
              component={RouterLink}
              size="small"
              startIcon={<ArrowBackIcon />}
              sx={{ borderRadius: 1, minHeight: 40 }}
              to="/"
              variant="outlined"
            >
              返回首页
            </Button>
            <Button
              color="inherit"
              component="a"
              href={roomFeedUrl}
              size="small"
              startIcon={<RssFeedIcon />}
              sx={{ borderRadius: 1, minHeight: 40 }}
              variant="outlined"
            >
              RSS
            </Button>
          </Stack>
          <AccountActions />
        </Box>

        {!isReady ? (
          <RoomAccessGate
            accessState={accessState}
            isSubmittingPassword={roomChannel.isSubmittingPassword}
            onRetry={roomChannel.retry}
            onSubmitPassword={roomChannel.submitPassword}
            roomId={roomId}
          />
        ) : (
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                alignItems: { xs: 'flex-start', sm: 'center' },
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1.5,
                justifyContent: 'space-between',
                minWidth: 0
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  component="h1"
                  sx={{ overflowWrap: 'anywhere' }}
                  variant="h4"
                >
                  {metadata.title?.trim() || metadata.stream_id}
                </Typography>
                {metadata.title?.trim() && metadata.title.trim() !== metadata.stream_id ? (
                  <Typography
                    color="text.secondary"
                    sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
                    variant="body2"
                  >
                    房间 {metadata.stream_id}
                  </Typography>
                ) : null}
              </Box>

              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}
              >
                <Chip
                  color={metadata.require_login ? 'warning' : 'default'}
                  icon={<PersonOutlineIcon />}
                  label={metadata.require_login ? '登录：需要' : '登录：无需'}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  color={metadata.has_password ? 'warning' : 'default'}
                  icon={metadata.has_password ? <LockOutlinedIcon /> : <LockOpenOutlinedIcon />}
                  label={metadata.has_password ? '密码：已启用' : '密码：未启用'}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  aria-atomic="true"
                  aria-live="polite"
                  data-testid="viewer-count"
                  label={`${roomChannel.viewerCount} 人观看`}
                  size="small"
                  variant="outlined"
                />
                <Button
                  aria-controls="room-danmaku-panel"
                  aria-expanded={!isDanmakuPanelCollapsed}
                  color="inherit"
                  onClick={() => setIsDanmakuPanelCollapsed((collapsed) => !collapsed)}
                  size="small"
                  startIcon={<ChatBubbleOutlineIcon />}
                  sx={{ borderRadius: 1, minHeight: 32 }}
                  variant="outlined"
                >
                  {isDanmakuPanelCollapsed ? '展开弹幕栏' : '收起弹幕栏'}
                </Button>
              </Stack>
            </Box>

            <Box
              sx={{
                alignItems: 'stretch',
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: 2,
                minWidth: 0,
                width: '100%'
              }}
            >
              <Box sx={{ flex: '1 1 auto', minWidth: 0, width: '100%' }}>
                <MoyuPlayer
                  danmakuSettings={danmakuSettings}
                  danmakuMessages={roomChannel.messages}
                  roomId={roomId}
                  ticket={accessState.ticket}
                />
              </Box>
              {!isDanmakuPanelCollapsed ? (
                <Box
                  id="room-danmaku-panel"
                  sx={{
                    flex: { xs: '1 1 auto', md: '0 0 auto' },
                    minHeight: 0,
                    width: { xs: '100%', md: 320, lg: 360 }
                  }}
                >
                  <DanmakuPanel
                    composerError={roomChannel.composerError}
                    connection={roomChannel.connection}
                    messages={roomChannel.messages}
                    onSendMessage={roomChannel.sendMessage}
                    onSettingsChange={setDanmakuSettings}
                    settings={danmakuSettings}
                    viewer={accessState.viewer}
                  />
                </Box>
              ) : null}
            </Box>
          </Stack>
        )}
      </Stack>
    </Container>
  )
}
