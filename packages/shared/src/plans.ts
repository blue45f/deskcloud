/**
 * B2B 플랜 모델 — 시트(멤버)·리소스(정책/API 키)·월 API 호출 한도의 단일 출처.
 * 티어 구조는 B2B_REVENUE_PLAN.md termsdesk 섹션 기준, 수치는 데모에서 한도 도달을
 * 시연하기 쉽게 조인 값(free 2/3/1/1k · pro 5/20/3/50k · team 20/∞/10/500k).
 *
 * 중요: 청구는 mock 입니다 — 플랜 변경은 결정 기록(audit)만 남기고 실제 자금 이동이 없습니다.
 */

export const PLAN_IDS = ['free', 'pro', 'team'] as const
export type PlanId = (typeof PLAN_IDS)[number]

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === 'string' && (PLAN_IDS as readonly string[]).includes(v)
}

/** 한도 값 -1 = 무제한. */
export const UNLIMITED = -1

export interface PlanLimits {
  /** 조직 멤버(시트) 수 */
  members: number
  /** 활성(보관 제외) 정책 수 */
  policies: number
  /** 활성(폐기 제외) API 키 수 */
  apiKeys: number
  /** 월(UTC) API 키 경유 호출 수 */
  apiCallsPerMonth: number
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { members: 2, policies: 3, apiKeys: 1, apiCallsPerMonth: 1_000 },
  pro: { members: 5, policies: 20, apiKeys: 3, apiCallsPerMonth: 50_000 },
  team: { members: 20, policies: UNLIMITED, apiKeys: 10, apiCallsPerMonth: 500_000 },
}

export const PLAN_LABELS: Record<PlanId, string> = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team',
}

export const PLAN_TAGLINES: Record<PlanId, string> = {
  free: '평가·소규모 시작',
  pro: '성장하는 팀의 표준',
  team: '본격 운영 · 대규모 연동',
}

/** 표시용 월 요금(KRW) — 데모 가격이며 실제 결제는 없습니다. */
export const PLAN_PRICES_KRW: Record<PlanId, number> = {
  free: 0,
  pro: 49_000,
  team: 149_000,
}

export const isUnlimited = (limit: number): boolean => limit === UNLIMITED

/** 현재 수가 한도 미만인지(무제한이면 항상 true). 생성 가드 공용 판정. */
export const withinLimit = (limit: number, current: number): boolean =>
  isUnlimited(limit) || current < limit

/** 한도 표시: -1 → '무제한', 그 외 천 단위 구분. */
export const formatPlanLimit = (limit: number): string =>
  isUnlimited(limit) ? '무제한' : limit.toLocaleString('ko-KR')

/** 월 요금 표시: 0 → '0원', 그 외 '49,000원'. */
export const formatPlanPrice = (krw: number): string => `${krw.toLocaleString('ko-KR')}원`

/** 한도+단위 표기: -1 → '무제한'(단위 생략), 그 외 '3개' · '50,000회'. */
export const formatPlanLimitWithUnit = (limit: number, unit: string): string =>
  isUnlimited(limit) ? '무제한' : `${formatPlanLimit(limit)}${unit}`

/** 티어 비교 항목(설정 플랜 카드·랜딩 가격 섹션 공유) — 한도 표기가 흩어지지 않게 단일 출처. */
export const planLimitBullets = (id: PlanId): string[] => {
  const l = PLAN_LIMITS[id]
  return [
    `멤버 ${formatPlanLimitWithUnit(l.members, '명')}`,
    `활성 정책 ${formatPlanLimitWithUnit(l.policies, '개')}`,
    `API 키 ${formatPlanLimitWithUnit(l.apiKeys, '개')}`,
    `월 API 호출 ${formatPlanLimitWithUnit(l.apiCallsPerMonth, '회')}`,
  ]
}
