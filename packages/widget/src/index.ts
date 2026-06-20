/**
 * @moderationdesk/widget — 임베드 신고 버튼 + 클라이언트 사전검사.
 *
 * - React 소비자: `import { ReportButton } from '@moderationdesk/widget'`
 * - 사전검사 훅/배지: `import { useModerationCheck, ModerationBadge } from '@moderationdesk/widget'`
 * - 클라이언트만 필요: `import { createModerationDeskClient } from '@moderationdesk/widget'`
 * - 바닐라(비-React) 사이트: `@moderationdesk/widget/vanilla` 또는 IIFE 빌드(window.ModerationDesk)
 *
 * 전부 publishable 키(pk_)로 동작 — 브라우저 안전. 차단 게이트는 서버(@moderationdesk/sdk).
 */
export {
  createModerationDeskClient,
  ModerationDeskError,
  type ModerationDeskClient,
  type ModerationDeskClientOptions,
  type CheckOptions,
  type ModerateResultDto,
  type ReportReceiptDto,
  type SubmitReportInput,
} from './client'

export { ReportButton, DEFAULT_REASONS, type ReportButtonProps } from './react'

export {
  ModerationBadge,
  useModerationCheck,
  type ModerationBadgeProps,
  type ModerationCheckState,
  type UseModerationCheckOptions,
} from './badge'

export { WIDGET_CSS, DEFAULT_ACCENT, DEFAULT_ACCENT_INK, type WidgetTheme } from './styles'

export { mount, init, type MountOptions, type WidgetHandle } from './vanilla'
