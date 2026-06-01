import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'

import Home from './pages/Home.tsx'
import Room from './pages/Room.tsx'
import Login from './pages/Login.tsx'
import Admin from './pages/Admin.tsx'
import ProtectedRoute from './components/ProtectedRoute.tsx'

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/live" element={<Navigate to="/" replace />} />
          <Route path="/live/:roomId" element={<Room />} />
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
