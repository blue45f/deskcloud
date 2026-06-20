/** 키 접두사 — publishable(브라우저)·secret(서버). 접두로 종류를 즉시 구분한다. */
export const PUBLISHABLE_KEY_PREFIX = "pk_";
export const SECRET_KEY_PREFIX = "sk_";

/** 키 본문(접두 제외) 길이. pk=32 hex(16바이트), sk=48 hex(24바이트). */
export const PUBLISHABLE_KEY_BYTES = 16;
export const SECRET_KEY_BYTES = 24;

/** 테넌트 요금제 — free 만 구현(유료는 자리표시자). */
export const PLANS = ["free", "pro"] as const;
export type Plan = (typeof PLANS)[number];

/** free 요금제의 월간 메시지 상한(소프트 캡). 초과 시 publish 거부. */
export const FREE_MESSAGE_CAP = 100_000;

/** 동시 연결 상한(소프트 캡, free). */
export const FREE_CONNECTION_CAP = 100;

/** 요금제별 상한 룩업. */
export const PLAN_CAPS: Readonly<
  Record<Plan, { messages: number; connections: number }>
> = {
  free: { messages: FREE_MESSAGE_CAP, connections: FREE_CONNECTION_CAP },
  pro: { messages: 10_000_000, connections: 10_000 },
};

/** 채널 이름 규약 — 영숫자·`:`·`_`·`-`·`.`, 1~128자. 테넌트 범위로 격리된다. */
export const CHANNEL_RE = /^[A-Za-z0-9_.:-]{1,128}$/;

/** 이벤트 이름 규약 — 영숫자·`:`·`_`·`-`·`.`, 1~128자. */
export const EVENT_RE = /^[A-Za-z0-9_.:-]{1,128}$/;

/** 채널당 보관 메시지 기본 상한(history). 서버 env REALTIME_HISTORY_LIMIT 로 덮어쓸 수 있음. */
export const DEFAULT_HISTORY_LIMIT = 50;

/** history 조회 시 한 번에 가져올 수 있는 최대 개수. */
export const MAX_HISTORY_LIMIT = 200;

/** WS socket.io 마운트 기본 경로(게이트웨이 호환 — 트레일링 슬래시 없음). */
export const DEFAULT_REALTIME_PATH = "/realtime";

/** WS 클라이언트 → 서버 이벤트 이름. */
export const WS_CLIENT_EVENTS = {
  subscribe: "subscribe",
  unsubscribe: "unsubscribe",
  presence: "presence",
} as const;

/** WS 서버 → 클라이언트 이벤트 이름. */
export const WS_SERVER_EVENTS = {
  message: "message",
  presenceState: "presence:state",
  presenceJoin: "presence:join",
  presenceLeave: "presence:leave",
  error: "error",
} as const;

/** WS 핸드셰이크에서 pk 를 전달하는 키 이름(auth 페이로드 또는 query). */
export const WS_AUTH_KEY = "key";
