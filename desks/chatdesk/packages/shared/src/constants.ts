/** 키 접두사 — publishable(브라우저)·secret(서버). 접두로 종류를 즉시 구분한다. */
export const PUBLISHABLE_KEY_PREFIX = 'pk_'
export const SECRET_KEY_PREFIX = 'sk_'

/** 멤버 토큰 접두 — 호스트 서버가 sk 로 발급하는 단명 토큰(`mt_`). */
export const MEMBER_TOKEN_PREFIX = 'mt_'

/** 키 본문(접두 제외) 길이. pk=32 hex(16바이트), sk=48 hex(24바이트). */
export const PUBLISHABLE_KEY_BYTES = 16
export const SECRET_KEY_BYTES = 24

/** 테넌트 요금제 — free 만 구현(유료는 자리표시자). */
export const PLANS = ['free', 'pro'] as const
export type Plan = (typeof PLANS)[number]

/** free 요금제의 메시지 상한(소프트 캡). 초과 시 발송 거부. */
export const FREE_MESSAGE_CAP = 100_000

/** 요금제별 상한 룩업. */
export const PLAN_CAPS: Readonly<Record<Plan, { messages: number }>> = {
  free: { messages: FREE_MESSAGE_CAP },
  pro: { messages: 10_000_000 },
}

/** 대화 종류 — 1:1 쪽지(dm) | 그룹/룸(group). */
export const CONVERSATION_KINDS = ['dm', 'group'] as const
export type ConversationKind = (typeof CONVERSATION_KINDS)[number]

/** 멤버 식별자 규약 — 호스트 앱의 사용자 id. 영숫자·`:`·`_`·`-`·`.`·`@`, 1~128자. */
export const MEMBER_ID_RE = /^[A-Za-z0-9_.:@-]{1,128}$/

/** 대화 제목 최대 길이(그룹). */
export const MAX_TITLE_LEN = 200

/** 메시지 본문 최대 길이. */
export const MAX_BODY_LEN = 8_000

/** 그룹 대화 최대 멤버 수(데모 소프트 캡). */
export const MAX_GROUP_MEMBERS = 500

/** 첨부 최대 개수. */
export const MAX_ATTACHMENTS = 10

/** 히스토리 조회 시 한 번에 가져올 수 있는 최대/기본 개수. */
export const DEFAULT_MESSAGE_LIMIT = 30
export const MAX_MESSAGE_LIMIT = 100

/** WS socket.io 마운트 기본 경로(게이트웨이 호환 — 트레일링 슬래시 없음). */
export const DEFAULT_CHAT_PATH = '/chat'

/** 멤버 토큰 기본 만료(초). 호스트 서버가 sk 로 발급. */
export const DEFAULT_MEMBER_TOKEN_TTL_SEC = 3_600

/** WS 클라이언트 → 서버 이벤트 이름. */
export const WS_CLIENT_EVENTS = {
  join: 'join',
  leave: 'leave',
  typing: 'typing',
  read: 'read',
} as const

/** WS 서버 → 클라이언트 이벤트 이름. */
export const WS_SERVER_EVENTS = {
  /** 새 메시지(발송·시스템). */
  message: 'message',
  /** 메시지 모더레이션(삭제) 통지. */
  messageDeleted: 'message:deleted',
  /** 메시지 모더레이션 취소(복원) 통지 — 본문 복구. */
  messageRestored: 'message:restored',
  /** 타이핑 인디케이터 릴레이. */
  typing: 'typing',
  /** 읽음 리시트 갱신. */
  read: 'read',
  /** presence 스냅샷(join 직후). */
  presenceState: 'presence:state',
  /** presence 변경(참여/이탈). */
  presenceJoin: 'presence:join',
  presenceLeave: 'presence:leave',
  /** 오류 통지. */
  error: 'error',
} as const

/** WS 핸드셰이크에서 pk 를 전달하는 키 이름(auth 페이로드 또는 query). */
export const WS_AUTH_KEY = 'key'
/** WS 핸드셰이크에서 memberId 를 전달하는 키 이름. */
export const WS_AUTH_MEMBER = 'memberId'
/** WS 핸드셰이크에서 멤버 토큰(선택)을 전달하는 키 이름. */
export const WS_AUTH_TOKEN = 'token'
