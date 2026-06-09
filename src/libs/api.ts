// API base URL — override in production via VITE_API_BASE env var
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:9081'

// Token refresh coordination — prevents infinite 401 → refresh → 401 loops
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

function getToken(): string | null {
  return localStorage.getItem('jwt')
}

/** Raw fetch-based refresh — bypasses the request() interceptor to avoid loops */
async function refreshTokenInternal(): Promise<string> {
  const token = getToken()
  const resp = await fetch(`${API_BASE}/api/account/refresh`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!resp.ok) throw new Error('Refresh failed')
  const data = await resp.json()
  if (data.code !== 0) throw new Error(data.msg || 'Refresh failed')
  const newToken: string = data.data.token
  localStorage.setItem('jwt', newToken)
  return newToken
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ code: number; msg: string; data: T }> {
  const url = `${API_BASE}${path}`
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal })
    clearTimeout(timeoutId)

    if (res.status === 401 && token) {
      if (!isRefreshing) {
        isRefreshing = true
        try {
          const newToken = await refreshTokenInternal()
          isRefreshing = false
          refreshSubscribers.forEach((cb) => cb(newToken))
          refreshSubscribers = []
          headers['Authorization'] = `Bearer ${newToken}`
          const retryRes = await fetch(url, { ...options, headers })
          return retryRes.json()
        } catch {
          isRefreshing = false
          refreshSubscribers = []
          localStorage.removeItem('jwt')
          window.location.href = '/login'
          return Promise.reject(new Error('Session expired'))
        }
      } else {
        // Queue this request — retry after the ongoing refresh completes
        return new Promise((resolve) => {
          refreshSubscribers.push((newToken: string) => {
            headers['Authorization'] = `Bearer ${newToken}`
            fetch(url, { ...options, headers })
              .then((r) => r.json())
              .then(resolve)
          })
        })
      }
    }

    return res.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResult {
  token: string
}

export async function login(params: LoginParams): Promise<LoginResult> {
  const res = await request<LoginResult>('/api/account/login', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '登录失败')
  }
  return res.data
}

export interface StreamInfo {
  id: number
  stream_id: string
  app: string
  vhost: string
  user_id: number
  client_id: string
  server_id: string
  stream_url: string
  status: string
  video_codec: string
  audio_codec: string
  video_width: number
  video_height: number
  started_at: string
  ended_at: string | null
}

export interface LiveRoom {
  stream_id: string
  title: string
  app: string
  status: string
  started_at_ms: number | null
  live_ms: number
  video_width: number | null
  video_height: number | null
  recv_kbps: number | null
  send_kbps: number | null
}

export interface StreamCodeInfo {
  stream_code: string
  stream_id: string
  username: string
  title?: string
}

export interface RoomTitleInfo {
  stream_id: string
  username: string
  title: string
}

export interface ServerStatus {
  device_id: string
  ip: string
  cpu_usage: number
  mem_usage: number
  uptime_seconds: number
  last_heartbeat: string
}

export interface PlaybackProtocolsInfo {
  protocols: string[]
}

export interface PublishProtocolsInfo {
  protocols: string[]
}

export async function refreshToken(): Promise<LoginResult> {
  try {
    const token = await refreshTokenInternal()
    return { token }
  } catch {
    throw new Error('刷新token失败')
  }
}

export async function getStreamCode(): Promise<StreamCodeInfo> {
  const res = await request<StreamCodeInfo>('/api/live/stream/code')
  if (res.code !== 0) {
    throw new Error(res.msg || '获取推流码失败')
  }
  return res.data
}

export async function resetStreamCode(): Promise<StreamCodeInfo> {
  const res = await request<StreamCodeInfo>('/api/live/stream/code/reset', {
    method: 'POST',
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '重置推流码失败')
  }
  return res.data
}

export async function updateRoomTitle(title: string): Promise<RoomTitleInfo> {
  const res = await request<RoomTitleInfo>('/api/live/room/title', {
    method: 'PUT',
    body: JSON.stringify({ title }),
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '保存直播间标题失败')
  }
  return res.data
}

export async function stopStream(streamId: string): Promise<void> {
  const res = await request<null>('/api/live/stream/stop', {
    method: 'POST',
    body: JSON.stringify({ stream_id: streamId }),
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '结束直播失败')
  }
}

export async function listStreams(): Promise<StreamInfo[]> {
  const res = await request<StreamInfo[]>('/api/live/stream/list')
  if (res.code !== 0) {
    throw new Error(res.msg || '获取直播列表失败')
  }
  return res.data
}

export async function listLiveRooms(): Promise<LiveRoom[]> {
  const res = await request<LiveRoom[]>('/api/live/rooms')
  if (res.code !== 0) {
    throw new Error(res.msg || '获取直播间列表失败')
  }
  return res.data
}

export async function getServerStatus(): Promise<ServerStatus[]> {
  const res = await request<ServerStatus[]>('/api/system/status')
  if (res.code !== 0) {
    throw new Error(res.msg || '获取服务器状态失败')
  }
  return res.data
}

export async function getPlaybackProtocols(): Promise<PlaybackProtocolsInfo> {
  const res = await request<PlaybackProtocolsInfo>('/api/playback/protocols')
  if (res.code !== 0) {
    throw new Error(res.msg || '获取播放协议失败')
  }
  return res.data
}

export async function getPublishProtocols(): Promise<PublishProtocolsInfo> {
  const res = await request<PublishProtocolsInfo>('/api/publish/protocols')
  if (res.code !== 0) {
    throw new Error(res.msg || '获取推流协议失败')
  }
  return res.data
}

export interface ForwardRule {
  id: number
  stream_filter: string
  target_url: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export async function listForwardRules(): Promise<ForwardRule[]> {
  const res = await request<ForwardRule[]>('/api/live/forward/rules')
  if (res.code !== 0) {
    throw new Error(res.msg || '获取转发规则列表失败')
  }
  return res.data
}

export async function addForwardRule(streamFilter: string, targetUrl: string): Promise<ForwardRule> {
  const res = await request<ForwardRule>('/api/live/forward/rules', {
    method: 'POST',
    body: JSON.stringify({ stream_filter: streamFilter, target_url: targetUrl }),
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '添加转发规则失败')
  }
  return res.data
}

export interface UpdateForwardRuleParams {
  stream_filter?: string
  target_url?: string
  enabled?: boolean
}

export async function updateForwardRule(
  id: number,
  params: UpdateForwardRuleParams
): Promise<ForwardRule> {
  const res = await request<ForwardRule>(`/api/live/forward/rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '更新转发规则失败')
  }
  return res.data
}

export interface DeleteForwardRuleResult {
  deleted: boolean
}

export async function deleteForwardRule(id: number): Promise<DeleteForwardRuleResult> {
  const res = await request<DeleteForwardRuleResult>(`/api/live/forward/rules/${id}`, {
    method: 'DELETE',
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '删除转发规则失败')
  }
  return res.data
}
