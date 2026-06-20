/**
 * @chatdesk/sdk — 브라우저 ChatClient(pk) + 서버 ChatAdmin(sk).
 *
 * - 브라우저:  import { createChatClient } from '@chatdesk/sdk'
 * - 서버(sk): import { createChatAdmin } from '@chatdesk/sdk/admin'
 *
 * 브라우저 진입(이 파일)은 socket.io-client 를 끌어온다. 서버 코드는 admin 진입을 써서
 * socket.io 의존 없이 REST 만으로 동작한다.
 */
export {
  createChatClient,
  ChatDeskError,
  type ChatClient,
  type ChatClientOptions,
  type ConnectionState,
  type ConversationRoom,
  type ConversationListItemDto,
  type MessageDto,
  type MessageHistoryDto,
  type MyConversationsDto,
  type SendResultDto,
} from './client'

export { SDK_VERSION } from './rest'

// 편의: 서버 admin 도 메인 진입에서 재노출(번들러가 안 쓰면 트리셰이킹). 단, 브라우저에서
// admin 을 직접 쓰지 말 것(sk 노출 금지) — 전용 진입은 '@chatdesk/sdk/admin'.
export { createChatAdmin, type ChatAdmin, type ChatAdminOptions } from './admin'
