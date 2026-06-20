/**
 * @communitydesk/widget — 임베드 커뮤니티·게시판 위젯.
 *
 * - React 소비자: `import { CommunityBoard, CommunityFeed } from '@communitydesk/widget'`
 * - 클라이언트만 필요: `@communitydesk/sdk` 를 직접 쓰세요(이 패키지는 UI 전용).
 * - 바닐라(비-React) 사이트: `@communitydesk/widget/vanilla` 또는 IIFE 빌드(window.CommunityDesk)
 */
export {
  CommunityBoard,
  CommunityFeed,
  type CommunityBoardProps,
  type CommunityFeedProps,
} from './react'

export { WIDGET_CSS, DEFAULT_ACCENT, DEFAULT_ACCENT_INK, type WidgetTheme } from './styles'

export {
  mount,
  mountFeed,
  init,
  type MountBoardOptions,
  type MountFeedOptions,
  type WidgetHandle,
} from './vanilla'

// SDK 클라이언트 재노출(편의) — 위젯과 같은 트리에서 직접 호출하고 싶을 때.
export {
  createCommunityBrowserClient,
  type CommunityBrowserClient,
  type CommunityBrowserClientOptions,
} from '@communitydesk/sdk/browser'
