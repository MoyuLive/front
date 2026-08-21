import type { DanmakuMessage } from '../../libs/api'
import type { DanmakuDisplaySettings } from '../../storages/player'

import styles from './DanmakuOverlay.module.scss'
import {
  getDanmakuStyle,
  getDanmakuVisibleLimit,
  normalizeDanmakuDisplaySettings
} from './danmakuPresentation'

export interface DanmakuOverlayProps {
  messages: readonly DanmakuMessage[]
  settings: DanmakuDisplaySettings
}

export default function DanmakuOverlay({ messages, settings }: DanmakuOverlayProps) {
  const normalizedSettings = normalizeDanmakuDisplaySettings(settings)

  if (!normalizedSettings.enabled) return null

  const visibleMessages = messages.slice(-getDanmakuVisibleLimit(normalizedSettings))

  return (
    <div aria-hidden="true" className={styles.overlay} data-testid="danmaku-overlay">
      {visibleMessages.map((message) => {
        return (
          <span key={message.id} className={styles.message} style={getDanmakuStyle(normalizedSettings, message.id)}>
            <span className={styles.sender}>{message.sender.name}</span>
            {'：'}
            {message.content}
          </span>
        )
      })}
    </div>
  )
}
