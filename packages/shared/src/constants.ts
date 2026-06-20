/** 구독 플랜 식별자 — 모든 Desk가 `tenant.plan` 으로 읽어 한도를 강제한다. */
export const PLANS = ['free', 'pro', 'scale', 'enterprise'] as const
export type Plan = (typeof PLANS)[number]

/**
 * 사용량 미터링 메트릭 — AuthDesk 의 과금/한도 기준 단위.
 *  - auth_users: 테넌트 풀의 end-user 수(스냅샷성 메트릭)
 *  - logins: 누적 로그인 성공 수
 */
export const USAGE_METRICS = ['auth_users', 'logins'] as const
export type UsageMetric = (typeof USAGE_METRICS)[number]

/** 플랜별 end-user 수 상한(`auth_users`). -1 은 무제한. */
export const PLAN_USER_LIMITS: Record<Plan, number> = {
  free: 1_000,
  pro: 50_000,
  scale: 500_000,
  enterprise: -1,
}

/** 한도 무제한 표식. */
export const UNLIMITED = -1

/** 플랜의 end-user 수 상한(`auth_users`). 알 수 없는 플랜은 안전하게 free 한도로 강등. */
export function planUserLimit(plan: Plan): number {
  return PLAN_USER_LIMITS[plan] ?? PLAN_USER_LIMITS.free
}

/** 메트릭별 플랜 한도. 현재 한도가 정의된 메트릭은 `auth_users`(end-user 수)뿐. */
export function metricLimit(plan: Plan, metric: UsageMetric): number {
  return metric === 'auth_users' ? planUserLimit(plan) : UNLIMITED
}

/** 한도(`limit`)가 무제한이면 true(-1 표식). */
export function isUnlimited(limit: number): boolean {
  return limit === UNLIMITED
}

/** 한도 대비 사용량이 가득 찼는지 — 무제한은 절대 false. (가입 한도 강제에 사용) */
export function isAtLimit(used: number, limit: number): boolean {
  return !isUnlimited(limit) && used >= limit
}

/** 남은 여유 — 무제한이면 -1, 아니면 max(0, limit - used). */
export function remainingQuota(used: number, limit: number): number {
  if (isUnlimited(limit)) return UNLIMITED
  return Math.max(0, limit - used)
}

/** API 키 프리픽스 — 한눈에 종류를 구분(publishable=공개 안전, secret=서버 전용). */
export const PUBLISHABLE_KEY_PREFIX = 'pk_'
export const SECRET_KEY_PREFIX = 'sk_'

/** 키 본문(prefix 제외) 길이 — 24바이트 → base64url 32자. */
export const KEY_RANDOM_BYTES = 24

/** slug — 테넌트 식별 슬러그. 소문자/숫자/하이픈, 1~64자(appId 규약과 동일). */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 비밀번호 정책 — 최소/최대 길이. (해시는 scrypt(node:crypto), 검증은 길이·문자 다양성만.) */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 200

/** 이름 최대 길이. */
export const NAME_MAX = 120

/** end-user 액세스 토큰 기본 수명(초) — 1시간. (짧은 액세스 토큰) */
export const DEFAULT_ACCESS_TTL_SECONDS = 60 * 60
