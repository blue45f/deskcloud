/**
 * ChatDesk 서버 admin SDK — secret 키(sk_…)로 호출. 호스트 서버에서만 사용한다(브라우저 금지).
 * 의존성 0(node fetch 만). socket.io 없음 — 모든 발송은 REST 로 영속화되고 서버가 WS 브로드캐스트.
 *
 *   const admin = createChatAdmin({ secretKey, endpoint })
 *   const conv = await admin.createConversation({ kind: 'dm', memberIds: ['alice', 'bob'] })
 *   await admin.systemSend(conv.id, '공지: 점검이 예정되어 있습니다.')
 *   const token = await admin.issueMemberToken('alice')   // 브라우저 강화 인증용
 */
import {
  type ConversationDto,
  type CreateConversationInput,
  type DeleteMessageResultDto,
  type MemberTokenDto,
  type MessageHistoryDto,
  type SendResultDto,
  type SystemMessageInput,
} from '@chatdesk/shared'

import { createRest, qs, type Rest } from './rest'

export { ChatDeskError } from './rest'
export type {
  ConversationDto,
  CreateConversationInput,
  DeleteMessageResultDto,
  MemberTokenDto,
  MessageHistoryDto,
  SendResultDto,
} from '@chatdesk/shared'

export interface ChatAdminOptions {
  /** secret 키(sk_…) — 서버 전용. 브라우저에 노출 금지. */
  secretKey: string
  /** API 베이스 URL. 예: 'https://chat.example.com'. */
  endpoint: string
  /** 커스텀 fetch(Node<18/테스트). 기본 전역 fetch. */
  fetch?: typeof fetch
}

export interface ChatAdmin {
  /** 대화 생성 — DM(멤버쌍 dedupe) 또는 group. */
  createConversation: (
    input: CreateConversationInput,
    signal?: AbortSignal
  ) => Promise<ConversationDto>
  /** 테넌트의 모든 대화(최신순). */
  listConversations: (signal?: AbortSignal) => Promise<ConversationDto[]>
  /** 대화 메시지 히스토리(모니터, 멤버십 무관) — before 커서·limit. */
  messages: (
    conversationId: string,
    opts?: { before?: string; limit?: number },
    signal?: AbortSignal
  ) => Promise<MessageHistoryDto>
  /** 시스템 발송 — 발신자 없는 공지/자동화 메시지. 영속화 + WS 브로드캐스트. */
  systemSend: (
    conversationId: string,
    body: string,
    attachments?: SystemMessageInput['attachments'],
    signal?: AbortSignal
  ) => Promise<SendResultDto>
  /** 모더레이션 — 메시지 soft delete + WS 통지. */
  deleteMessage: (messageId: string, signal?: AbortSignal) => Promise<DeleteMessageResultDto>
  /** 모더레이션 취소 — soft delete 된 메시지 복원 + WS 통지(본문 복구). */
  restoreMessage: (messageId: string, signal?: AbortSignal) => Promise<DeleteMessageResultDto>
  /** 멤버 토큰 발급 — 브라우저 ChatClient 의 memberToken 으로 전달(강화 인증). */
  issueMemberToken: (
    memberId: string,
    ttlSec?: number,
    signal?: AbortSignal
  ) => Promise<MemberTokenDto>
}

export function createChatAdmin(options: ChatAdminOptions): ChatAdmin {
  const rest: Rest = createRest({
    endpoint: options.endpoint,
    key: options.secretKey,
    fetch: options.fetch,
  })

  return {
    createConversation(input, signal) {
      return rest.post<ConversationDto>('/api/conversations', input, signal)
    },
    listConversations(signal) {
      return rest.get<ConversationDto[]>('/api/admin/conversations', signal)
    },
    messages(conversationId, opts, signal) {
      const query = qs({ before: opts?.before, limit: opts?.limit })
      return rest.get<MessageHistoryDto>(
        `/api/admin/conversations/${encodeURIComponent(conversationId)}/messages${query}`,
        signal
      )
    },
    systemSend(conversationId, body, attachments, signal) {
      const input: SystemMessageInput = { body, attachments }
      return rest.post<SendResultDto>(
        `/api/admin/conversations/${encodeURIComponent(conversationId)}/system-message`,
        input,
        signal
      )
    },
    deleteMessage(messageId, signal) {
      return rest.del<DeleteMessageResultDto>(
        `/api/admin/messages/${encodeURIComponent(messageId)}`,
        signal
      )
    },
    restoreMessage(messageId, signal) {
      return rest.post<DeleteMessageResultDto>(
        `/api/admin/messages/${encodeURIComponent(messageId)}/restore`,
        undefined,
        signal
      )
    },
    issueMemberToken(memberId, ttlSec, signal) {
      return rest.post<MemberTokenDto>('/api/members/token', { memberId, ttlSec }, signal)
    },
  }
}
