/**
 * @notifydesk/widget — 임베드 알림 벨 위젯.
 *
 * - React 소비자: `import { NotificationBell } from '@notifydesk/widget'`
 * - 클라이언트만 필요: `import { createNotifyDeskWidgetClient } from '@notifydesk/widget'`
 * - 바닐라(비-React) 사이트: `@notifydesk/widget/vanilla` 또는 IIFE 빌드(window.NotifyDesk)
 *
 * 위젯은 publishable(`pk_`) 키로 자기 인박스만 읽고/읽음 처리한다(브라우저 노출 안전).
 * 알림 발송·어드민은 서버에서 secret(`sk_`) 키 + @notifydesk/sdk 를 쓴다.
 */
export {
  createNotifyDeskWidgetClient,
  NotifyDeskWidgetError,
  type InboxDto,
  type MarkReadResultDto,
  type NotificationDto,
  type NotifyDeskWidgetClient,
  type NotifyDeskWidgetClientOptions,
  type UnreadCountDto,
} from './client'

export { NotificationBell, type NotificationBellProps, type WidgetAlign } from './react'

export { WIDGET_CSS, DEFAULT_ACCENT, DEFAULT_ACCENT_INK, type WidgetTheme } from './styles'

export { formatRelativeTime } from './relative-time'

export { mount, init, type MountOptions, type WidgetHandle } from './vanilla'
