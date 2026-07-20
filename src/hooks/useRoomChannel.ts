import { useCallback, useEffect, useRef, useState } from 'react'

import {
  API_BASE,
  ApiError,
  getPublicRoom,
  requestRoomAccess,
  type DanmakuMessage,
  type PublicRoomMetadata,
  type RoomAccessResult,
  type RoomServerMessage,
  type ViewerIdentity
} from '../libs/api'
import { clearToken, decodeToken } from '../libs/auth'
import {
  consumeAccessAttempt,
  consumeMetadataRefresh,
  gateFromFreshMetadata,
  newRecoveryBudget,
  type RecoveryBudget,
  type RecoveryTrigger
} from '../libs/roomAccessState'
import { buildRoomWebSocketUrl } from '../libs/streamUrls'
import { getOrCreateGuestId, unicodeLength } from '../libs/viewerIdentity'

const MAX_MESSAGES = 100
const TICKET_RENEWAL_WINDOW_MS = 30000
const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 15000] as const

export type AccessState =
  | { kind: 'loading' }
  | { kind: 'login_required'; message: string }
  | { kind: 'password_required'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; ticket: string; expiresAt: number; viewer: ViewerIdentity }

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'

export interface UseRoomChannelResult {
  metadata: PublicRoomMetadata | null
  accessState: AccessState
  connection: ConnectionState
  viewerCount: number
  messages: readonly DanmakuMessage[]
  composerError: string
  isSubmittingPassword: boolean
  submitPassword: (password: string) => Promise<void>
  retry: () => void
  sendMessage: (content: string) => boolean
}

type CycleReason = 'initial' | 'user_retry' | 'password_submit' | 'recovery'

interface CycleOptions {
  reason: CycleReason
  pageGeneration: number
  submittedPassword?: string
  recoveryTrigger?: RecoveryTrigger
}

interface RecordValue {
  [key: string]: unknown
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null
}

function isViewerIdentity(value: unknown): value is ViewerIdentity {
  return isRecord(value) &&
    (value.kind === 'user' || value.kind === 'guest') &&
    typeof value.name === 'string'
}

function parseRoomServerMessage(value: unknown): RoomServerMessage {
  if (typeof value !== 'string') {
    throw new Error('Room channel messages must be text')
  }

  const parsed: unknown = JSON.parse(value)
  if (!isRecord(parsed) || typeof parsed.type !== 'string') {
    throw new Error('Invalid room channel message')
  }

  if (
    parsed.type === 'viewer_count' &&
    typeof parsed.count === 'number' &&
    Number.isFinite(parsed.count) &&
    parsed.count >= 0
  ) {
    return { type: 'viewer_count', count: Math.floor(parsed.count) }
  }

  if (
    parsed.type === 'danmaku' &&
    typeof parsed.id === 'string' &&
    isViewerIdentity(parsed.sender) &&
    typeof parsed.content === 'string' &&
    typeof parsed.sent_at === 'string'
  ) {
    return {
      type: 'danmaku',
      id: parsed.id,
      sender: parsed.sender,
      content: parsed.content,
      sent_at: parsed.sent_at
    }
  }

  if (
    parsed.type === 'error' &&
    (parsed.code === 'rate_limited' || parsed.code === 'invalid_message') &&
    typeof parsed.message === 'string'
  ) {
    return { type: 'error', code: parsed.code, message: parsed.message }
  }

  throw new Error('Invalid room channel message')
}

function metadataErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return '房间不存在'
    if (error.status === 400) return '直播间地址或请求参数有误'
    if (error.status === 401) return '登录状态已失效，请重试'
    if (error.status === 403) return '访问策略已变化，请重试'
  }

  return error instanceof Error ? error.message : '获取直播间信息失败'
}

function accessErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    return '访问请求参数有误'
  }
  return error instanceof Error ? error.message : '获取直播间访问凭证失败'
}

export function useRoomChannel(roomId: string): UseRoomChannelResult {
  const [metadata, setMetadata] = useState<PublicRoomMetadata | null>(null)
  const [accessState, setAccessState] = useState<AccessState>({ kind: 'loading' })
  const [connection, setConnection] = useState<ConnectionState>('idle')
  const [viewerCount, setViewerCount] = useState(0)
  const [messages, setMessages] = useState<readonly DanmakuMessage[]>([])
  const [composerError, setComposerError] = useState('')
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false)

  const mountedRef = useRef(false)
  const roomIdRef = useRef(roomId)
  const pageGenerationRef = useRef(0)
  const cycleSequenceRef = useRef(0)
  const transportGenerationRef = useRef(0)
  const accessStateRef = useRef<AccessState>({ kind: 'loading' })
  const metadataRef = useRef<PublicRoomMetadata | null>(null)
  const guestIdRef = useRef('')
  const passwordRef = useRef<string>()
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number>()
  const expiryTimerRef = useRef<number>()
  const reconnectAttemptRef = useRef(0)
  const recoveryInFlightRef = useRef<Promise<void> | null>(null)
  const reacquireInFlightRef = useRef<Promise<void> | null>(null)
  const messageBufferRef = useRef<readonly DanmakuMessage[]>([])
  const messageIdsRef = useRef(new Set<string>())

  const runCycleRef = useRef<(options: CycleOptions) => Promise<void>>(async () => undefined)
  const recoverAccessRef = useRef<(
    trigger: RecoveryTrigger,
    pageGeneration: number
  ) => Promise<void>>(async () => undefined)
  const applyAccessRef = useRef<(
    result: RoomAccessResult,
    freshMetadata: PublicRoomMetadata,
    password: string | undefined,
    pageGeneration: number,
    cycleId?: number
  ) => boolean>(() => false)
  const connectSocketRef = useRef<(
    readyState: Extract<AccessState, { kind: 'ready' }>,
    pageGeneration: number,
    transportGeneration: number
  ) => void>(() => undefined)
  const scheduleReconnectRef = useRef<(
    readyState: Extract<AccessState, { kind: 'ready' }>,
    pageGeneration: number,
    transportGeneration: number
  ) => void>(() => undefined)
  const reacquireTicketRef = useRef<(
    pageGeneration: number,
    transportGeneration: number
  ) => Promise<void>>(async () => undefined)

  const updateAccessState = useCallback((nextState: AccessState) => {
    accessStateRef.current = nextState
    setAccessState(nextState)
  }, [])

  const updateMetadata = useCallback((nextMetadata: PublicRoomMetadata | null) => {
    metadataRef.current = nextMetadata
    setMetadata(nextMetadata)
  }, [])

  const isCurrentPage = useCallback((pageGeneration: number) => (
    mountedRef.current && pageGenerationRef.current === pageGeneration
  ), [])

  const stopTransport = useCallback(() => {
    transportGenerationRef.current += 1

    if (reconnectTimerRef.current !== undefined) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = undefined
    }
    if (expiryTimerRef.current !== undefined) {
      window.clearTimeout(expiryTimerRef.current)
      expiryTimerRef.current = undefined
    }

    const socket = socketRef.current
    socketRef.current = null
    if (socket) {
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
      try {
        socket.close()
      } catch {
        // A socket can already be closed while the browser dispatches cleanup.
      }
    }

    reacquireInFlightRef.current = null
  }, [])

  const appendDanmaku = useCallback((message: DanmakuMessage) => {
    if (messageIdsRef.current.has(message.id)) return

    const nextMessages = [...messageBufferRef.current, message].slice(-MAX_MESSAGES)
    messageBufferRef.current = nextMessages
    messageIdsRef.current = new Set(nextMessages.map((item) => item.id))
    setMessages(nextMessages)
  }, [])

  scheduleReconnectRef.current = (readyState, pageGeneration, transportGeneration) => {
    if (
      !isCurrentPage(pageGeneration) ||
      transportGenerationRef.current !== transportGeneration ||
      accessStateRef.current.kind !== 'ready' ||
      reconnectTimerRef.current !== undefined ||
      socketRef.current !== null ||
      recoveryInFlightRef.current !== null ||
      reacquireInFlightRef.current !== null
    ) {
      return
    }

    const delay = RECONNECT_BACKOFF_MS[
      Math.min(reconnectAttemptRef.current, RECONNECT_BACKOFF_MS.length - 1)
    ]
    reconnectAttemptRef.current += 1
    setConnection('reconnecting')
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = undefined
      connectSocketRef.current(readyState, pageGeneration, transportGeneration)
    }, delay)
  }

  connectSocketRef.current = (readyState, pageGeneration, transportGeneration) => {
    if (
      !isCurrentPage(pageGeneration) ||
      transportGenerationRef.current !== transportGeneration ||
      accessStateRef.current.kind !== 'ready' ||
      socketRef.current !== null ||
      recoveryInFlightRef.current !== null
    ) {
      return
    }

    if (readyState.expiresAt - Date.now() < TICKET_RENEWAL_WINDOW_MS) {
      void reacquireTicketRef.current(pageGeneration, transportGeneration)
      return
    }

    setConnection(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting')

    let socket: WebSocket
    try {
      socket = new WebSocket(buildRoomWebSocketUrl(API_BASE, roomIdRef.current, readyState.ticket))
    } catch {
      setConnection('disconnected')
      scheduleReconnectRef.current(readyState, pageGeneration, transportGeneration)
      return
    }

    socketRef.current = socket

    socket.onopen = () => {
      if (
        !isCurrentPage(pageGeneration) ||
        transportGenerationRef.current !== transportGeneration ||
        socketRef.current !== socket
      ) {
        return
      }
      reconnectAttemptRef.current = 0
      setConnection('connected')
    }

    socket.onmessage = (event) => {
      if (
        !isCurrentPage(pageGeneration) ||
        transportGenerationRef.current !== transportGeneration ||
        socketRef.current !== socket
      ) {
        return
      }

      try {
        const message = parseRoomServerMessage(event.data)
        if (message.type === 'viewer_count') {
          setViewerCount(message.count)
        } else if (message.type === 'danmaku') {
          appendDanmaku(message)
        } else {
          setComposerError(message.message)
        }
      } catch {
        try {
          socket.close(1003, 'invalid message')
        } catch {
          socketRef.current = null
          setConnection('disconnected')
          scheduleReconnectRef.current(readyState, pageGeneration, transportGeneration)
        }
      }
    }

    socket.onerror = () => {
      if (socketRef.current !== socket) return
      try {
        socket.close()
      } catch {
        socketRef.current = null
        setConnection('disconnected')
        scheduleReconnectRef.current(readyState, pageGeneration, transportGeneration)
      }
    }

    socket.onclose = (event) => {
      if (
        !isCurrentPage(pageGeneration) ||
        transportGenerationRef.current !== transportGeneration ||
        socketRef.current !== socket
      ) {
        return
      }

      socketRef.current = null
      setConnection('disconnected')

      if (event.code === 1008) {
        void recoverAccessRef.current('ws_1008', pageGeneration)
        return
      }

      if (readyState.expiresAt - Date.now() < TICKET_RENEWAL_WINDOW_MS) {
        void reacquireTicketRef.current(pageGeneration, transportGeneration)
        return
      }

      scheduleReconnectRef.current(readyState, pageGeneration, transportGeneration)
    }
  }

  applyAccessRef.current = (
    result,
    freshMetadata,
    password,
    pageGeneration,
    cycleId
  ) => {
    if (
      !isCurrentPage(pageGeneration) ||
      (cycleId !== undefined && cycleSequenceRef.current !== cycleId)
    ) {
      return false
    }

    const expiresAt = Date.parse(result.expires_at)
    if (!Number.isFinite(expiresAt)) {
      stopTransport()
      passwordRef.current = undefined
      updateAccessState({ kind: 'error', message: '访问凭证有效期无效，请重试' })
      setConnection('idle')
      return false
    }
    if (expiresAt <= Date.now()) {
      stopTransport()
      passwordRef.current = undefined
      updateAccessState({ kind: 'error', message: '访问凭证已过期，请重试' })
      setConnection('idle')
      return false
    }

    stopTransport()
    reconnectAttemptRef.current = 0
    passwordRef.current = freshMetadata.has_password ? password : undefined
    const readyState: Extract<AccessState, { kind: 'ready' }> = {
      kind: 'ready',
      ticket: result.ticket,
      expiresAt,
      viewer: result.viewer
    }
    updateAccessState(readyState)

    const transportGeneration = transportGenerationRef.current
    const renewalDelay = Math.max(0, expiresAt - Date.now() - TICKET_RENEWAL_WINDOW_MS)
    expiryTimerRef.current = window.setTimeout(() => {
      expiryTimerRef.current = undefined
      void reacquireTicketRef.current(pageGeneration, transportGeneration)
    }, renewalDelay)
    connectSocketRef.current(readyState, pageGeneration, transportGeneration)
    return true
  }

  reacquireTicketRef.current = (pageGeneration, transportGeneration) => {
    if (
      !isCurrentPage(pageGeneration) ||
      transportGenerationRef.current !== transportGeneration ||
      accessStateRef.current.kind !== 'ready'
    ) {
      return Promise.resolve()
    }
    if (reacquireInFlightRef.current) {
      return reacquireInFlightRef.current
    }

    const freshMetadata = metadataRef.current
    if (!freshMetadata) {
      return recoverAccessRef.current('reacquire_failed', pageGeneration)
    }

    const request = requestRoomAccess(roomIdRef.current, {
      guest_id: guestIdRef.current,
      ...(passwordRef.current === undefined ? {} : { password: passwordRef.current })
    })
      .then((result) => {
        if (
          !isCurrentPage(pageGeneration) ||
          transportGenerationRef.current !== transportGeneration
        ) {
          return
        }
        applyAccessRef.current(
          result,
          freshMetadata,
          passwordRef.current,
          pageGeneration
        )
      })
      .catch(() => {
        if (
          isCurrentPage(pageGeneration) &&
          transportGenerationRef.current === transportGeneration
        ) {
          return recoverAccessRef.current('reacquire_failed', pageGeneration)
        }
      })
      .then(() => undefined)
      .finally(() => {
        if (reacquireInFlightRef.current === request) {
          reacquireInFlightRef.current = null
        }
      })

    reacquireInFlightRef.current = request
    return request
  }

  recoverAccessRef.current = (trigger, pageGeneration) => {
    if (!isCurrentPage(pageGeneration)) {
      return Promise.resolve()
    }
    if (recoveryInFlightRef.current) {
      return recoveryInFlightRef.current
    }

    passwordRef.current = undefined
    stopTransport()
    updateAccessState({ kind: 'loading' })
    setConnection('idle')

    const recovery = runCycleRef.current({
      reason: 'recovery',
      pageGeneration,
      recoveryTrigger: trigger
    }).finally(() => {
      if (recoveryInFlightRef.current === recovery) {
        recoveryInFlightRef.current = null
      }
    })
    recoveryInFlightRef.current = recovery
    return recovery
  }

  runCycleRef.current = async (options) => {
    if (!isCurrentPage(options.pageGeneration)) return

    const cycleId = ++cycleSequenceRef.current
    let budget: RecoveryBudget = newRecoveryBudget()

    if (options.reason !== 'password_submit') {
      updateAccessState({ kind: 'loading' })
    }
    stopTransport()
    setConnection('idle')
    setComposerError('')
    updateMetadata(null)
    if (options.reason !== 'password_submit') {
      passwordRef.current = undefined
    }

    const metadataBudget = consumeMetadataRefresh(budget)
    if (!metadataBudget) {
      updateAccessState({ kind: 'error', message: '本次恢复已用完直播间信息刷新次数' })
      return
    }
    budget = metadataBudget

    const validAccount = decodeToken()
    let freshMetadata: PublicRoomMetadata
    try {
      freshMetadata = await getPublicRoom(roomIdRef.current)
    } catch (error) {
      if (
        isCurrentPage(options.pageGeneration) &&
        cycleSequenceRef.current === cycleId
      ) {
        if (error instanceof ApiError && error.status === 401) {
          clearToken()
        }
        updateAccessState({ kind: 'error', message: metadataErrorMessage(error) })
      }
      return
    }

    if (
      !isCurrentPage(options.pageGeneration) ||
      cycleSequenceRef.current !== cycleId
    ) {
      return
    }

    updateMetadata(freshMetadata)
    setViewerCount(freshMetadata.viewer_count)

    const decision = gateFromFreshMetadata(freshMetadata, {
      hasValidAccount: validAccount !== null,
      submittedPassword: options.submittedPassword,
      recoveryTrigger: options.recoveryTrigger
    })

    if (decision.kind === 'login_required') {
      clearToken()
      passwordRef.current = undefined
      updateAccessState({
        kind: 'login_required',
        message: '此直播间需要登录后访问'
      })
      return
    }

    if (decision.kind === 'password_required') {
      passwordRef.current = undefined
      updateAccessState({
        kind: 'password_required',
        message: options.recoveryTrigger
          ? '房间密码不正确或访问已失效'
          : '请输入房间密码'
      })
      return
    }

    const accessBudget = consumeAccessAttempt(budget)
    if (!accessBudget) {
      updateAccessState({ kind: 'error', message: '本次恢复已用完访问请求次数' })
      return
    }
    budget = accessBudget

    try {
      const result = await requestRoomAccess(roomIdRef.current, {
        guest_id: guestIdRef.current,
        ...(decision.password === undefined ? {} : { password: decision.password })
      })
      applyAccessRef.current(
        result,
        freshMetadata,
        decision.password,
        options.pageGeneration,
        cycleId
      )
    } catch (error) {
      if (
        !isCurrentPage(options.pageGeneration) ||
        cycleSequenceRef.current !== cycleId
      ) {
        return
      }

      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403) &&
        !options.recoveryTrigger
      ) {
        const trigger: RecoveryTrigger = error.status === 401 ? 'access_401' : 'access_403'
        await recoverAccessRef.current(trigger, options.pageGeneration)
        return
      }

      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        passwordRef.current = undefined
        if (freshMetadata.has_password) {
          updateAccessState({
            kind: 'password_required',
            message: '房间密码不正确或访问已失效'
          })
        } else if (freshMetadata.require_login && error.status === 401) {
          clearToken()
          updateAccessState({
            kind: 'login_required',
            message: '登录状态已失效，请重新登录'
          })
        } else if (error.status === 401) {
          clearToken()
          updateAccessState({ kind: 'error', message: '登录状态已失效，请重试' })
        } else {
          updateAccessState({ kind: 'error', message: '访问策略已变化，请重试' })
        }
        return
      }

      updateAccessState({ kind: 'error', message: accessErrorMessage(error) })
    }
  }

  useEffect(() => {
    mountedRef.current = true
    roomIdRef.current = roomId
    const pageGeneration = pageGenerationRef.current + 1
    pageGenerationRef.current = pageGeneration
    cycleSequenceRef.current = 0
    recoveryInFlightRef.current = null
    passwordRef.current = undefined
    stopTransport()
    reconnectAttemptRef.current = 0
    messageBufferRef.current = []
    messageIdsRef.current = new Set()
    setMessages([])
    setViewerCount(0)
    setComposerError('')
    setIsSubmittingPassword(false)
    updateMetadata(null)
    updateAccessState({ kind: 'loading' })
    setConnection('idle')

    if (!roomId) {
      updateAccessState({ kind: 'error', message: '房间地址无效' })
      return () => {
        mountedRef.current = false
        pageGenerationRef.current += 1
        stopTransport()
      }
    }

    try {
      guestIdRef.current = getOrCreateGuestId()
    } catch {
      updateAccessState({ kind: 'error', message: '无法建立访客身份，请检查浏览器存储设置' })
      return () => {
        mountedRef.current = false
        pageGenerationRef.current += 1
        stopTransport()
      }
    }

    void runCycleRef.current({ reason: 'initial', pageGeneration })

    return () => {
      mountedRef.current = false
      pageGenerationRef.current += 1
      cycleSequenceRef.current += 1
      recoveryInFlightRef.current = null
      stopTransport()
    }
  }, [roomId, stopTransport, updateAccessState, updateMetadata])

  const submitPassword = useCallback(async (password: string) => {
    const pageGeneration = pageGenerationRef.current
    const length = unicodeLength(password)
    if (length < 6 || length > 64) {
      updateAccessState({
        kind: 'password_required',
        message: '房间密码必须为 6-64 个字符'
      })
      return
    }

    setIsSubmittingPassword(true)
    try {
      await runCycleRef.current({
        reason: 'password_submit',
        pageGeneration,
        submittedPassword: password
      })
    } finally {
      if (isCurrentPage(pageGeneration)) {
        setIsSubmittingPassword(false)
      }
    }
  }, [isCurrentPage, updateAccessState])

  const retry = useCallback(() => {
    const pageGeneration = pageGenerationRef.current
    recoveryInFlightRef.current = null
    void runCycleRef.current({ reason: 'user_retry', pageGeneration })
  }, [])

  const sendMessage = useCallback((content: string) => {
    const normalizedContent = content.trim()
    if (!normalizedContent) {
      setComposerError('弹幕内容不能为空')
      return false
    }
    if (unicodeLength(normalizedContent) > 100) {
      setComposerError('弹幕不能超过 100 个字符')
      return false
    }

    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || accessStateRef.current.kind !== 'ready') {
      setComposerError('连接未就绪，暂时无法发送')
      return false
    }

    try {
      socket.send(JSON.stringify({ type: 'send_message', content: normalizedContent }))
      setComposerError('')
      return true
    } catch {
      setComposerError('弹幕发送失败，请稍后重试')
      return false
    }
  }, [])

  return {
    metadata,
    accessState,
    connection,
    viewerCount,
    messages,
    composerError,
    isSubmittingPassword,
    submitPassword,
    retry,
    sendMessage
  }
}
