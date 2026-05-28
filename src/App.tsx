import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'

import Room from './pages/Room.tsx'
import Login from './pages/Login.tsx'
import Admin from './pages/Admin.tsx'
import ProtectedRoute from './components/ProtectedRoute.tsx'

function Redirect({ to }: { to: string }) {
  const nav = useNavigate()
  useEffect(() => {
    nav(to)
  }, [nav, to])
  return <div>redirect to {to}</div>
}

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Redirect to="/live" />} />
          <Route path="/live/:roomId?" element={<Room />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<ProtectedRoute />}>
            <Route index element={<Admin />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
