/** 알림 채널 — 위젯/SDK 렌더링·발송 파이프라인·선호 설정의 기준. */
export const CHANNELS = [
  'in_app', // 항상 저장(인박스). 비활성화 불가의 1차 채널.
  'email', // 이메일(pluggable 어댑터: console-log 기본 · SMTP 선택).
  'web_push', // 웹 푸시(VAPID). 키 미설정이면 no-op.
] as const
export type Channel = (typeof CHANNELS)[number]

/** in_app 은 항상 저장되므로 선호 설정으로 끌 수 없는 채널. */
export const ALWAYS_ON_CHANNELS: readonly Channel[] = ['in_app']

/** 알림 상태 — 인박스 라이프사이클. */
export const NOTIFICATION_STATUSES = ['queued', 'sent', 'read'] as const
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

/** 요금제 — free 는 누적 발송 소프트 캡 적용, pro 는 무제한. */
export const PLANS = ['free', 'pro'] as const
export type Plan = (typeof PLANS)[number]

/** 무료 플랜 기본 소프트 캡(env FREE_PLAN_CAP 로 override). */
export const DEFAULT_FREE_PLAN_CAP = 1000

/** 테넌트 slug — 소문자/숫자/하이픈, 1~64자. URL·식별자로 사용. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** recipientId — 테넌트 측 사용자 식별자(불투명 문자열). 영숫자·._-@ 허용, 1~200자. */
export const RECIPIENT_ID_RE = /^[A-Za-z0-9._@-]+$/

/** 템플릿 key — 테넌트별 알림 종류 식별자. 영숫자·._- 허용, 1~80자. */
export const TEMPLATE_KEY_RE = /^[A-Za-z0-9._-]+$/

/** 키 접두사 — publishable(브라우저 노출 가능) · secret(서버 전용, 해시 저장). */
export const PUBLISHABLE_KEY_PREFIX = 'pk_'
export const SECRET_KEY_PREFIX = 'sk_'

/** 키 본문(접두사 뒤) 길이 — base62 무작위. */
export const KEY_BODY_LENGTH = 32

/** title/body 최대 길이(저장·발송 안전 한도). */
export const TITLE_MAX = 200
export const BODY_MAX = 4000

/** mustache-ish 변수 토큰 — `{{ var }}` (공백 허용). 변수명은 영숫자·._- (점 표기 중첩 지원). */
export const TEMPLATE_VAR_RE = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g
