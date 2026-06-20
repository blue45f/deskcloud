import type { MessageDto, PresenceDto } from './dto'

/**
 * WS 와이어 타입 — 클라이언트(브라우저 SDK)와 게이트웨이가 공유하는 페이로드 모양.
 * 이벤트 이름 상수는 constants.ts 의 WS_CLIENT_EVENTS / WS_SERVER_EVENTS 참조.
 */

/** 핸드셰이크 auth 페이로드(socket.io `auth`). */
export interface HandshakeAuth {
  /** publishable 키(pk_). query `?key=` 로도 받을 수 있음. */
  key?: string
  /** 멤버 식별자(필수). query `?memberId=` 로도 받을 수 있음. */
  memberId?: string
  /** 멤버 토큰(선택, 강화 인증). */
  token?: string
}

/** 서버 → 클라이언트: 새 메시지(발송·시스템). */
export type ServerMessageEvent = MessageDto

/** 서버 → 클라이언트: 메시지 삭제(모더레이션) 통지. */
export interface ServerMessageDeletedEvent {
  conversationId: string
  messageId: string
}

/** 서버 → 클라이언트: 메시지 복원(모더레이션 취소) 통지 — 본문이 복구된 전체 메시지. */
export type ServerMessageRestoredEvent = MessageDto

/** 서버 → 클라이언트: 타이핑 인디케이터 릴레이. */
export interface ServerTypingEvent {
  conversationId: string
  memberId: string
  typing: boolean
}

/** 서버 → 클라이언트: 읽음 리시트 갱신. */
export interface ServerReadEvent {
  conversationId: string
  memberId: string
  lastReadMessageId: string | null
  readAt: string
}

/** 서버 → 클라이언트: presence 스냅샷(join 직후 등). */
export type ServerPresenceStateEvent = PresenceDto

/** 서버 → 클라이언트: presence 변경(참여/이탈). */
export interface ServerPresenceDeltaEvent {
  conversationId: string
  member: string
  count: number
}

/** 서버 → 클라이언트: 오류 통지. */
export interface ServerErrorEvent {
  code: string
  message: string
}

/** join/leave/typing/read ack(서버가 돌려주는 응답). */
export interface AckOk {
  ok: true
}
export interface AckErr {
  ok: false
  code: string
  message: string
}
export type Ack = AckOk | AckErr
