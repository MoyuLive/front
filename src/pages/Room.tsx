import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import RssFeedIcon from '@mui/icons-material/RssFeed'
import { Box, Button, Container, Stack } from '@mui/material'
import { Link as RouterLink, useParams } from 'react-router-dom'

import MoyuPlayer from '../components/player/MoyuPlayer'

export default function Room() {
  const { roomId } = useParams()
  const roomFeedUrl = roomId ? `/feeds/live/${encodeURIComponent(roomId)}` : '/feeds/live.xml'

  return (
    <Container
      disableGutters
      maxWidth="xl"
      sx={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: { xs: '100dvh', sm: 'auto' },
        mt: { xs: 0, sm: 2 },
        px: { xs: 0, sm: 2 },
        py: { xs: 1, sm: 3 },
        width: '100%'
      }}
    >
      <Stack spacing={{ xs: 1, sm: 1.5 }} sx={{ mx: 'auto', width: '100%' }}>
        <Box
          sx={{
            alignItems: 'center',
            display: 'flex',
            gap: 1,
            justifyContent: 'space-between',
            px: { xs: 1, sm: 0 },
            width: '100%'
          }}
        >
          <Button
            color="inherit"
            component={RouterLink}
            size="small"
            startIcon={<ArrowBackIcon />}
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.06)',
              borderColor: 'divider',
              borderRadius: 1,
              minHeight: 36,
              textTransform: 'none',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.12)',
                borderColor: 'text.secondary'
              }
            }}
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
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.06)',
              borderColor: 'divider',
              borderRadius: 1,
              minHeight: 36,
              textTransform: 'none',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.12)',
                borderColor: 'text.secondary'
              }
            }}
            variant="outlined"
          >
            RSS
          </Button>
        </Box>
        <Box sx={{ mx: 'auto', width: '100%' }}>
          <MoyuPlayer roomId={roomId ?? ''} />
        </Box>
      </Stack>
    </Container>
  )
}
