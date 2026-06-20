import type { MessageDto, PresenceDto } from "./dto";

/**
 * WS 와이어 타입 — 클라이언트(브라우저 SDK)와 게이트웨이가 공유하는 페이로드 모양.
 * 이벤트 이름 상수는 constants.ts 의 WS_CLIENT_EVENTS / WS_SERVER_EVENTS 참조.
 */

/** 핸드셰이크 auth 페이로드(socket.io `auth`). */
export interface HandshakeAuth {
  /** publishable 키(pk_). query `?key=` 로도 받을 수 있음. */
  key?: string;
}

/** 서버 → 클라이언트: publish 된 메시지. */
export type ServerMessageEvent = MessageDto;

/** 서버 → 클라이언트: presence 스냅샷(구독 직후 등). */
export type ServerPresenceStateEvent = PresenceDto;

/** 서버 → 클라이언트: presence 변경(참여/이탈). */
export interface ServerPresenceDeltaEvent {
  channel: string;
  member: string;
  count: number;
}

/** 서버 → 클라이언트: 오류 통지. */
export interface ServerErrorEvent {
  code: string;
  message: string;
}

/** subscribe/unsubscribe/presence ack(서버가 돌려주는 응답). */
export interface AckOk {
  ok: true;
}
export interface AckErr {
  ok: false;
  code: string;
  message: string;
}
export type Ack = AckOk | AckErr;
