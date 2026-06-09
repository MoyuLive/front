import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Outlet } from 'react-router-dom'
import {
  AppBar,
  Alert,
  Box,
  Chip,
  CircularProgress,
  Toolbar,
  Typography,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText
} from '@mui/material'
import LiveTvIcon from '@mui/icons-material/LiveTv'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import DnsIcon from '@mui/icons-material/Dns'
import CallSplitIcon from '@mui/icons-material/CallSplit'
import LogoutIcon from '@mui/icons-material/Logout'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import PeopleIcon from '@mui/icons-material/People'

import css from '../css/admin.module.scss'
import { AdminMe, getAdminMe } from '../libs/api'
import { clearToken, isAdminRole } from '../libs/auth'

import AdminLiveList from './AdminLiveList'
import AdminForwardRules from './AdminForwardRules'
import AdminRooms from './AdminRooms'
import AdminStreamCode from './AdminStreamCode'
import AdminSystem from './AdminSystem'
import AdminUsers from './AdminUsers'

const DRAWER_WIDTH = 240

interface NavItem {
  label: string
  icon: React.ReactNode
  key: string
}

const navItems: NavItem[] = [
  { label: '直播管理', icon: <LiveTvIcon />, key: 'live' },
  { label: '直播间管理', icon: <MeetingRoomIcon />, key: 'rooms' },
  { label: '推流码', icon: <VpnKeyIcon />, key: 'code' },
  { label: '转发管理', icon: <CallSplitIcon />, key: 'forward' },
  { label: '系统状态', icon: <DnsIcon />, key: 'system' }
]

export default function Admin() {
  const navigate = useNavigate()
  const [me, setMe] = useState<AdminMe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeNav, setActiveNav] = useState('code')

  useEffect(() => {
    getAdminMe()
      .then((data) => {
        setMe(data)
        setActiveNav(isAdminRole(data.role) ? 'rooms' : 'code')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '加载账号失败')
      })
      .finally(() => setLoading(false))
  }, [])

  const availableNavItems = useMemo(() => {
    const items = [{ label: '推流码', icon: <VpnKeyIcon />, key: 'code' }]
    if (!me?.is_admin) return items

    const adminItems = navItems
    if (me.is_super_admin) {
      return [{ label: '用户管理', icon: <PeopleIcon />, key: 'users' }, ...adminItems]
    }
    return adminItems
  }, [me])

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  const renderContent = () => {
    switch (activeNav) {
      case 'users':
        return me?.is_super_admin ? <AdminUsers /> : <AdminStreamCode />
      case 'rooms':
        return me?.is_admin ? <AdminRooms isSuperAdmin={Boolean(me?.is_super_admin)} /> : <AdminStreamCode />
      case 'live':
        return me?.is_admin ? <AdminLiveList /> : <AdminStreamCode />
      case 'code':
        return <AdminStreamCode />
      case 'forward':
        return me?.is_admin ? <AdminForwardRules /> : <AdminStreamCode />
      case 'system':
        return me?.is_admin ? <AdminSystem /> : <AdminStreamCode />
      default:
        return <AdminStreamCode />
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
          {me ? (
            <Chip
              color={me.is_super_admin ? 'secondary' : me.is_admin ? 'primary' : 'default'}
              label={me.is_super_admin ? '超级管理员' : me.is_admin ? '管理员' : '用户'}
              size="small"
              sx={{ mr: 2, color: 'white' }}
            />
          ) : null}
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
            {availableNavItems.map((item) => (
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
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          renderContent()
        )}
      </Box>
      <Outlet />
    </Box>
  )
}
