/** 구독 플랜 식별자 — 모든 Desk가 `tenant.plan` 으로 읽어 한도를 강제한다. */
export const PLANS = ['free', 'pro', 'scale', 'enterprise'] as const
export type Plan = (typeof PLANS)[number]

/** 멤버(좌석) 역할 — owner 1명 + admin/member 다수. */
export const MEMBER_ROLES = ['owner', 'admin', 'member'] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]

/** 사용량 미터링 메트릭 — Desk별 과금/한도의 기준 단위. */
export const USAGE_METRICS = [
  'api_calls', // 모든 Desk 공통: API 호출 수
  'events', // 수집 이벤트(응답·리뷰·알림 발송 등)
  'storage_mb', // 저장 사용량(MiB)
  'seats', // 점유 좌석 수(스냅샷성 메트릭)
] as const
export type UsageMetric = (typeof USAGE_METRICS)[number]

/** API 키 프리픽스 — 한눈에 종류를 구분(publishable=공개 안전, secret=서버 전용). */
export const PUBLISHABLE_KEY_PREFIX = 'pk_'
export const SECRET_KEY_PREFIX = 'sk_'

/** 키 본문(prefix 제외) 길이 — 24바이트 → base64url 32자. */
export const KEY_RANDOM_BYTES = 24

/** slug — 테넌트 식별 슬러그. 소문자/숫자/하이픈, 1~64자(appId 규약과 동일). */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 사용량 집계 기간 — 'current' 는 진행 중인 달(UTC), 그 외 'YYYY-MM'. */
export const USAGE_PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/** 한도 무제한 표식 — PlanLimit 의 -1 은 "제한 없음". */
export const UNLIMITED = -1
