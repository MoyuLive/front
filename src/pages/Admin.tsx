import { useState } from 'react'
import { useNavigate, Outlet } from 'react-router-dom'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box
} from '@mui/material'
import LiveTvIcon from '@mui/icons-material/LiveTv'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import DnsIcon from '@mui/icons-material/Dns'
import CallSplitIcon from '@mui/icons-material/CallSplit'
import LogoutIcon from '@mui/icons-material/Logout'

import css from '../css/admin.module.scss'

import AdminLiveList from './AdminLiveList'
import AdminStreamCode from './AdminStreamCode'
import AdminSystem from './AdminSystem'
import AdminForwardRules from './AdminForwardRules'

const DRAWER_WIDTH = 240

interface NavItem {
  label: string
  icon: React.ReactNode
  key: string
}

const navItems: NavItem[] = [
  { label: '直播管理', icon: <LiveTvIcon />, key: 'live' },
  { label: '推流码', icon: <VpnKeyIcon />, key: 'code' },
  { label: '转发管理', icon: <CallSplitIcon />, key: 'forward' },
  { label: '系统状态', icon: <DnsIcon />, key: 'system' }
]

export default function Admin() {
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState('live')

  const handleLogout = () => {
    localStorage.removeItem('jwt')
    navigate('/login')
  }

  const renderContent = () => {
    switch (activeNav) {
      case 'live':
        return <AdminLiveList />
      case 'code':
        return <AdminStreamCode />
      case 'forward':
        return <AdminForwardRules />
      case 'system':
        return <AdminSystem />
      default:
        return <AdminLiveList />
    }
  }

  return (
    <Box className={css.adminLayout}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Yantube 管理后台
          </Typography>
          <Button color="inherit" onClick={handleLogout} startIcon={<LogoutIcon />}>
            退出
          </Button>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box'
          }
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {navItems.map((item) => (
              <ListItem key={item.key} disablePadding>
                <ListItemButton
                  selected={activeNav === item.key}
                  onClick={() => setActiveNav(item.key)}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box component="main" className={css.adminMain}>
        {renderContent()}
      </Box>
      <Outlet />
    </Box>
  )
}
