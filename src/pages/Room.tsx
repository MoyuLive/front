import { Box, Container } from '@mui/material'
import { useParams } from 'react-router-dom'

import MoyuPlayer from '../components/player/MoyuPlayer'

export default function Room() {
  const { roomId } = useParams()

  return (
    <Container
      disableGutters
      maxWidth="xl"
      sx={{
        alignItems: 'flex-start',
        display: 'flex',
        justifyContent: 'center',
        minHeight: { xs: '100dvh', sm: 'auto' },
        mt: { xs: 0, sm: 2 },
        px: { xs: 0, sm: 2 },
        py: { xs: 0, sm: 3 },
        width: '100%'
      }}
    >
      <Box sx={{ mx: 'auto', width: '100%' }}>
        <MoyuPlayer roomId={roomId ?? ''} />
      </Box>
    </Container>
  )
}
