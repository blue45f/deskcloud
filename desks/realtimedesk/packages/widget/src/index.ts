/**
 * @realtimedesk/widget — 임베드 presence 위젯.
 *
 * - React 소비자: `import { PresenceBar, useRealtime } from '@realtimedesk/widget'`
 * - 바닐라(비-React) 사이트: `@realtimedesk/widget/vanilla` 또는 IIFE 빌드(window.RealtimeDesk)
 *
 * 네트워크 계약은 @realtimedesk/sdk(client) 가 담당한다(socket.io over /realtime).
 */
export { PresenceBar, type PresenceBarProps } from "./react";

export {
  useRealtime,
  type UseRealtimeOptions,
  type UseRealtimeResult,
  type ConnectionStatus,
  type MessageDto,
  type PresenceDto,
} from "./useRealtime";

export {
  WIDGET_CSS,
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_INK,
  avatarColor,
  avatarInitial,
  type WidgetTheme,
} from "./styles";

export { mount, init, type MountOptions, type WidgetHandle } from "./vanilla";
