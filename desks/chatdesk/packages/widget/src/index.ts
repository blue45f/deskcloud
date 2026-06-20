/**
 * @chatdesk/widget — 임베드 채팅 위젯.
 *
 * - React 소비자:  `import { ChatWidget } from '@chatdesk/widget'`
 * - SDK 만 필요:   `import { createChatClient } from '@chatdesk/sdk'`
 * - 바닐라(비-React): `@chatdesk/widget/vanilla` 또는 IIFE 빌드(window.ChatDesk)
 */
export { ChatWidget, type ChatWidgetProps, type WidgetPosition } from './react'

export { WIDGET_CSS, DEFAULT_ACCENT, DEFAULT_ACCENT_INK, type WidgetTheme } from './styles'

export { mount, init, type MountOptions, type WidgetHandle } from './vanilla'

// 방문 ping(fire-and-forget) — 위젯이 마운트 시 자동 호출하지만, SDK 만 쓰는 호스트가
// 직접 트래픽을 보고할 수도 있게 노출한다.
export { pingVisit } from './track'

// SDK 재노출(편의) — 위젯 없이 클라이언트만 쓰고 싶을 때.
export {
  createChatClient,
  ChatDeskError,
  type ChatClient,
  type ChatClientOptions,
  type ConversationRoom,
} from '@chatdesk/sdk'
