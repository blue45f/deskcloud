/**
 * @changelogdesk/widget — 임베드 체인지로그('What's new') 위젯.
 *
 * - React 소비자: `import { ChangelogWidget } from '@changelogdesk/widget'`
 * - 클라이언트만 필요: `import { createChangelogDeskClient } from '@changelogdesk/widget'`
 * - 바닐라(비-React) 사이트: `@changelogdesk/widget/vanilla` 또는 IIFE 빌드(window.ChangelogDesk)
 */
export {
  createChangelogDeskClient,
  ChangelogDeskError,
  type ChangelogDeskClient,
  type ChangelogDeskClientOptions,
  type ListEntriesParams,
  type PublicChangelogDto,
  type SeenInput,
  type UnreadCountDto,
} from './client'

export {
  ChangelogWidget,
  type ChangelogWidgetProps,
  type WidgetPosition,
} from './react'

export { WIDGET_CSS, DEFAULT_ACCENT, DEFAULT_ACCENT_INK, type WidgetTheme } from './styles'

export { mount, init, type MountOptions, type WidgetHandle } from './vanilla'

export { getAnonId } from './anon'
