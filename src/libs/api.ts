import { clearToken, getToken, UserRole } from './auth'

// API base URL — override in production via VITE_API_BASE env var
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:9081'

// Token refresh coordination — prevents infinite 401 → refresh → 401 loops
let refreshPromise: Promise<string> | undefined

interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

interface RequestOptions extends RequestInit {
  refreshOn401?: boolean
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function parseApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  try {
    return await response.json() as ApiResponse<T>
  } catch {
    throw new ApiError(response.status, response.status, 'Invalid API response')
  }
}

function throwApiError<T>(response: Response, body: ApiResponse<T>): never {
  throw new ApiError(response.status, body.code, body.msg || 'Request failed')
}

const REQUEST_TIMEOUT_MS = 30000

/** Every request gets its own abort timer so no fetch can hang forever. */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

/** Raw fetch-based refresh — bypasses the request() interceptor to avoid loops */
async function refreshTokenInternal(): Promise<string> {
  const token = getToken()
  const resp = await fetchWithTimeout(`${API_BASE}/api/account/refresh`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const data = await parseApiResponse<LoginResult>(resp)
  if (!resp.ok) throwApiError(resp, data)
  if (data.code !== 0) throw new ApiError(resp.status, data.code, data.msg || 'Refresh failed')
  const newToken = data.data.token
  localStorage.setItem('jwt', newToken)
  return newToken
}

function refreshTokenOnce(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshTokenInternal().finally(() => {
      refreshPromise = undefined
    })
  }
  return refreshPromise
}

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<{ code: number; msg: string; data: T }> {
  const { refreshOn401 = true, ...fetchOptions } = options
  const url = `${API_BASE}${path}`
  const token = getToken()
  const isFormDataBody = fetchOptions.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
    ...(fetchOptions.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetchWithTimeout(url, { ...fetchOptions, headers })
  const body = await parseApiResponse<T>(res)

  if (res.status === 401 && token && refreshOn401) {
    let newToken: string
    try {
      newToken = await refreshTokenOnce()
    } catch {
      clearToken()
      window.location.href = '/login'
      throw new Error('Session expired')
    }
    headers['Authorization'] = `Bearer ${newToken}`
    const retryRes = await fetchWithTimeout(url, { ...fetchOptions, headers })
    const retryBody = await parseApiResponse<T>(retryRes)
    if (!retryRes.ok) throwApiError(retryRes, retryBody)
    return retryBody
  }

  if (!res.ok) throwApiError(res, body)
  return body
}

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResult {
  token: string
}

export interface AdminMe {
  id: number
  username: string
  role: UserRole
  is_admin: boolean
  is_super_admin: boolean
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

export async function register(params: LoginParams): Promise<LoginResult> {
  const res = await request<LoginResult>('/api/account/create', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '注册失败')
  }
  return res.data
}

export async function logout(): Promise<void> {
  const res = await request<null>('/api/account/logout', {
    method: 'POST',
    refreshOn401: false,
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '退出登录失败')
  }
}

export async function getAdminMe(): Promise<AdminMe> {
  const res = await request<AdminMe>('/api/admin/me')
  if (res.code !== 0) {
    throw new Error(res.msg || '获取当前账号失败')
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
  cover_url: string
  app: string
  status: string
  started_at_ms: number | null
  live_ms: number
  video_width: number | null
  video_height: number | null
  recv_kbps: number | null
  send_kbps: number | null
  require_login: boolean
  has_password: boolean
  viewer_count: number
}

export interface StreamCodeInfo {
  id?: number
  stream_code: string
  stream_id: string
  username: string
  title?: string
  cover_url?: string
  enabled?: boolean
}

export interface RoomTitleInfo {
  stream_id: string
  username: string
  title: string
  cover_url: string
}

export interface RoomCoverInfo {
  id?: number
  stream_id: string
  username: string
  cover_url: string
}

export interface OwnLiveRoom {
  id: number
  user_id: number
  username: string
  stream_id: string
  title: string
  cover_url: string
  stream_code: string
  enabled: boolean
  require_login: boolean
  has_password: boolean
  status: 'live' | 'offline'
  created_at: string
  updated_at: string
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

export type ViewerKind = 'user' | 'guest'

export interface ViewerIdentity {
  kind: ViewerKind
  name: string
}

export interface PublicRoomMetadata {
  stream_id: string
  title: string
  cover_url: string
  status: 'live' | 'offline'
  require_login: boolean
  has_password: boolean
  viewer_count: number
}

export interface RoomAccessResult {
  ticket: string
  expires_at: string
  viewer: ViewerIdentity
}

export interface RoomAccessParams {
  guest_id: string
  password?: string
}

export interface RoomPrivacyInput {
  require_login: boolean
  password_enabled: boolean
  password?: string
}

export interface RoomPrivacyResult {
  require_login: boolean
  has_password: boolean
}

export type RoomServerMessage =
  | { type: 'viewer_count'; count: number }
  | { type: 'danmaku'; id: string; sender: ViewerIdentity; content: string; sent_at: string }
  | { type: 'error'; code: 'rate_limited' | 'invalid_message'; message: string }

export type DanmakuMessage = Extract<RoomServerMessage, { type: 'danmaku' }>

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

export async function listMyLiveRooms(): Promise<OwnLiveRoom[]> {
  const res = await request<OwnLiveRoom[]>('/api/live/my/rooms')
  if (res.code !== 0) {
    throw new Error(res.msg || '获取我的直播间失败')
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

export async function resetLiveRoomStreamCode(id: number): Promise<OwnLiveRoom> {
  const res = await request<OwnLiveRoom>(`/api/live/rooms/${id}/stream-code/reset`, {
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

export async function updateLiveRoomTitle(id: number, title: string): Promise<OwnLiveRoom> {
  const res = await request<OwnLiveRoom>(`/api/live/rooms/${id}/title`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '保存直播间标题失败')
  }
  return res.data
}

export async function updateRoomCover(file: Blob): Promise<RoomCoverInfo> {
  return uploadRoomCover('/api/live/room/cover', file)
}

export async function updateLiveRoomCover(id: number, file: Blob): Promise<RoomCoverInfo> {
  return uploadRoomCover(`/api/live/rooms/${id}/cover`, file)
}

async function uploadRoomCover(path: string, file: Blob): Promise<RoomCoverInfo> {
  const formData = new FormData()
  const filename = file instanceof File ? file.name : 'cover.jpg'
  formData.append('cover', file, filename)

  const res = await request<RoomCoverInfo>(path, {
    method: 'PUT',
    body: formData,
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '保存直播间封面失败')
  }
  return res.data
}

export function resolveApiAssetUrl(value?: string | null): string {
  if (!value) return ''

  try {
    return new URL(value).toString()
  } catch {
    return value.startsWith('/') ? `${API_BASE}${value}` : `${API_BASE}/${value}`
  }
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

export async function getPublicRoom(streamId: string): Promise<PublicRoomMetadata> {
  const res = await request<PublicRoomMetadata>(
    `/api/live/rooms/${encodeURIComponent(streamId)}`
  )
  if (res.code !== 0) {
    throw new Error(res.msg || '获取直播间信息失败')
  }
  return res.data
}

export async function requestRoomAccess(
  streamId: string,
  params: RoomAccessParams
): Promise<RoomAccessResult> {
  const res = await request<RoomAccessResult>(
    `/api/live/rooms/${encodeURIComponent(streamId)}/access`,
    {
      method: 'POST',
      body: JSON.stringify(params),
      refreshOn401: false,
    }
  )
  if (res.code !== 0) {
    throw new Error(res.msg || '获取直播间访问凭证失败')
  }
  return res.data
}

export async function updateOwnedRoomPrivacy(
  id: number,
  input: RoomPrivacyInput
): Promise<RoomPrivacyResult> {
  const res = await request<RoomPrivacyResult>(`/api/live/rooms/${id}/privacy`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '保存直播间隐私设置失败')
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

export interface AdminUser {
  id: number
  username: string
  role: UserRole
  enabled: boolean
  room_count: number
}

export interface CreateAdminUserParams {
  username: string
  password: string
  role: UserRole
  enabled?: boolean
}

export interface UpdateAdminUserParams {
  username?: string
  password?: string
  role?: UserRole
  enabled?: boolean
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const res = await request<AdminUser[]>('/api/admin/users')
  if (res.code !== 0) {
    throw new Error(res.msg || '获取用户列表失败')
  }
  return res.data
}

export async function createAdminUser(params: CreateAdminUserParams): Promise<AdminUser> {
  const res = await request<AdminUser>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '创建用户失败')
  }
  return res.data
}

export async function updateAdminUser(
  id: number,
  params: UpdateAdminUserParams
): Promise<AdminUser> {
  const res = await request<AdminUser>(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '更新用户失败')
  }
  return res.data
}

export async function deleteAdminUser(id: number): Promise<{ deleted: boolean }> {
  const res = await request<{ deleted: boolean }>(`/api/admin/users/${id}`, {
    method: 'DELETE',
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '删除用户失败')
  }
  return res.data
}

export interface AdminRoom {
  id: number
  user_id: number
  username: string
  stream_id: string
  title: string
  cover_url: string
  stream_code: string
  enabled: boolean
  require_login: boolean
  has_password: boolean
  status: 'live' | 'offline'
  live_session: StreamInfo | null
  created_at: string
  updated_at: string
}

export interface CreateAdminRoomParams {
  user_id: number
  stream_id: string
  title?: string
  enabled?: boolean
  require_login?: boolean
  password_enabled?: boolean
  password?: string
}

export interface UpdateAdminRoomParams {
  user_id?: number
  stream_id?: string
  title?: string
  enabled?: boolean
  require_login?: boolean
  password_enabled?: boolean
  password?: string
}

export async function listAdminRooms(): Promise<AdminRoom[]> {
  const res = await request<AdminRoom[]>('/api/admin/rooms')
  if (res.code !== 0) {
    throw new Error(res.msg || '获取直播间列表失败')
  }
  return res.data
}

export async function createAdminRoom(params: CreateAdminRoomParams): Promise<AdminRoom> {
  const res = await request<AdminRoom>('/api/admin/rooms', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '创建直播间失败')
  }
  return res.data
}

export async function updateAdminRoom(
  id: number,
  params: UpdateAdminRoomParams
): Promise<AdminRoom> {
  const res = await request<AdminRoom>(`/api/admin/rooms/${id}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '更新直播间失败')
  }
  return res.data
}

export async function resetAdminRoomStreamCode(id: number): Promise<AdminRoom> {
  const res = await request<AdminRoom>(`/api/admin/rooms/${id}/stream-code/reset`, {
    method: 'POST',
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '重置推流链接失败')
  }
  return res.data
}

export async function deleteAdminRoom(id: number): Promise<{ deleted: boolean }> {
  const res = await request<{ deleted: boolean }>(`/api/admin/rooms/${id}`, {
    method: 'DELETE',
  })
  if (res.code !== 0) {
    throw new Error(res.msg || '删除直播间失败')
  }
  return res.data
}

export async function stopAdminStream(streamId: string): Promise<{ stream_id: string; stopped: boolean }> {
  const res = await request<{ stream_id: string; stopped: boolean }>(
    `/api/admin/streams/${encodeURIComponent(streamId)}/stop`,
    { method: 'POST' }
  )
  if (res.code !== 0) {
    throw new Error(res.msg || '中断直播失败')
  }
  return res.data
}
