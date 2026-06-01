import { Container } from '@mui/material'
import { useParams } from 'react-router-dom'

import MoyuPlayer from '../components/player/MoyuPlayer'

export default function Room() {
  const { roomId } = useParams()

  return (
    <Container
      maxWidth="xl"
      sx={{
        alignContent: 'center',
        justifyContent: 'center',
        marginTop: '20px'
      }}
    >
      <MoyuPlayer roomId={roomId ?? ''} />
    </Container>
  )
}
