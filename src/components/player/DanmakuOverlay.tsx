import type { CSSProperties } from 'react'

import type { DanmakuMessage } from '../../libs/api'

import styles from './DanmakuOverlay.module.scss'

const MAX_VISIBLE_MESSAGES = 24
const DESKTOP_TRACK_COUNT = 6
const MOBILE_TRACK_COUNT = 4

interface DanmakuMessageStyle extends CSSProperties {
  '--danmaku-duration': string
  '--danmaku-offset': string
  '--danmaku-offset-mobile': string
}

export interface DanmakuOverlayProps {
  messages: readonly DanmakuMessage[]
}

function hashMessageId(id: string) {
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export default function DanmakuOverlay({ messages }: DanmakuOverlayProps) {
  const visibleMessages = messages.slice(-MAX_VISIBLE_MESSAGES)

  return (
    <div aria-hidden="true" className={styles.overlay} data-testid="danmaku-overlay">
      {visibleMessages.map((message) => {
        const hash = hashMessageId(message.id)
        const style: DanmakuMessageStyle = {
          '--danmaku-duration': `${8 + (hash % 5)}s`,
          '--danmaku-offset': `${8 + (hash % DESKTOP_TRACK_COUNT) * 32}px`,
          '--danmaku-offset-mobile': `${4 + (hash % MOBILE_TRACK_COUNT) * 24}px`
        }

        return (
          <span key={message.id} className={styles.message} style={style}>
            <span className={styles.sender}>{message.sender.name}</span>
            {'：'}
            {message.content}
          </span>
        )
      })}
    </div>
  )
}
