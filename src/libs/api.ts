const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:9081'

function getToken(): string | null {
  return localStorage.getItem('jwt')
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ code: number; msg: string; data: T }> {
  const url = `${API_BASE}${path}`
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(url, {
    ...options,
    headers
  })
  return res.json()
}

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  expire: string
}

export interface StreamInfo {
  id: string
  name: string
  publisher: string
  status: string
  bitrate: number
  startTime: string
}

export interface StreamCodeInfo {
  code: string
}

export interface ServerStatus {
  device_id: string
  ip: string
  cpu_usage: number
  mem_usage: number
  uptime_seconds: number
  last_heartbeat: string
}

export async function login(params: LoginParams): Promise<LoginResult> {
  const url = `${API_BASE}/api/account/login`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  const json = await res.json()
  // gin-jwt returns { code: 200, token, expire } at top level
  if (!json.token) {
    throw new Error(json.message || '登录失败')
  }
  localStorage.setItem('jwt', json.token)
  return { token: json.token, expire: json.expire }
}

export async function refreshToken(): Promise<LoginResult> {
  const res = await request<LoginResult>('/api/account/refresh', {
    method: 'POST'
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '刷新token失败')
  }
  return res.data
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
    method: 'POST'
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '重置推流码失败')
  }
  return res.data
}

export async function getStreamStatus(): Promise<StreamInfo> {
  const res = await request<StreamInfo>('/api/live/stream/status')
  if (res.code !== 0) {
    throw new Error(res.msg || '获取直播状态失败')
  }
  return res.data
}

export async function stopStream(streamId: string): Promise<void> {
  const res = await request<null>('/api/live/stream/stop', {
    method: 'POST',
    body: JSON.stringify({ stream_id: streamId })
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

export async function getServerStatus(): Promise<ServerStatus[]> {
  const res = await request<ServerStatus[]>('/api/system/status')
  if (res.code !== 0) {
    throw new Error(res.msg || '获取服务器状态失败')
  }
  return res.data
}

export interface ForwardRule {
  id: number
  stream_filter: string
  target_url: string
  enabled: boolean
  created_at: string
}

export async function listForwardRules(): Promise<ForwardRule[]> {
  const res = await request<ForwardRule[]>('/api/live/forward/rules')
  if (res.code !== 0) {
    throw new Error(res.msg || '获取转发规则列表失败')
  }
  return res.data
}

export async function addForwardRule(streamFilter: string, targetUrl: string): Promise<void> {
  const res = await request<null>('/api/live/forward/rules', {
    method: 'POST',
    body: JSON.stringify({ stream_filter: streamFilter, target_url: targetUrl })
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '添加转发规则失败')
  }
}

export async function deleteForwardRule(id: number): Promise<void> {
  const res = await request<null>(`/api/live/forward/rules/${id}`, {
    method: 'DELETE'
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '删除转发规则失败')
  }
}
