import { UNLIMITED, type Plan, type UsageMetric } from './constants'

/**
 * 플랜별 한도(PlanLimit 맵). 모든 Desk가 이 맵을 읽어 `tenant.plan` 기준으로 한도를 강제한다.
 * `-1`(UNLIMITED)은 제한 없음. 메트릭 키는 USAGE_METRICS + 좌석/멤버 한도.
 *
 * 이 맵은 의도적으로 순수 데이터다 — `vendor/plan-limits.ts` 로도 단일파일 벤더링되어
 * npm publish 없이 각 Desk가 복사해 쓸 수 있다(드리프트 방지용 단일 소스).
 */
export interface PlanLimit {
  /** 사람이 읽는 플랜 이름. */
  label: string
  /** 월 가격(원, KRW). 0 = 무료, UNLIMITED 가 아님(가격은 0 이상). */
  priceKrwMonthly: number
  /** 월 가격(USD, 센트). 해외 결제·표시용. */
  priceUsdCentsMonthly: number
  /** 포함 좌석 수(멤버). 초과분은 seat add-on 또는 상위 플랜. */
  seats: number
  /** 월 API 호출 한도. */
  api_calls: number
  /** 월 이벤트(수집) 한도. */
  events: number
  /** 저장 한도(MiB). */
  storage_mb: number
  /** 마케팅용 — 'Powered by DeskCloud' 배지 제거 가능 여부(유료 특전). */
  removableBadge: boolean
}

export const PLAN_LIMITS: Readonly<Record<Plan, PlanLimit>> = {
  free: {
    label: 'Free',
    priceKrwMonthly: 0,
    priceUsdCentsMonthly: 0,
    seats: 1,
    api_calls: 10_000,
    events: 1_000,
    storage_mb: 100,
    removableBadge: false,
  },
  pro: {
    label: 'Pro',
    priceKrwMonthly: 29_000,
    priceUsdCentsMonthly: 1_900,
    seats: 5,
    api_calls: 200_000,
    events: 50_000,
    storage_mb: 5_000,
    removableBadge: true,
  },
  scale: {
    label: 'Scale',
    priceKrwMonthly: 99_000,
    priceUsdCentsMonthly: 7_900,
    seats: 20,
    api_calls: 2_000_000,
    events: 500_000,
    storage_mb: 50_000,
    removableBadge: true,
  },
  enterprise: {
    label: 'Enterprise',
    priceKrwMonthly: 0, // 영업 문의(custom)
    priceUsdCentsMonthly: 0,
    seats: UNLIMITED,
    api_calls: UNLIMITED,
    events: UNLIMITED,
    storage_mb: UNLIMITED,
    removableBadge: true,
  },
}

/** 메트릭의 플랜 한도를 조회. 좌석(seats)도 메트릭처럼 조회 가능. */
export function limitFor(plan: Plan, metric: UsageMetric): number {
  const l = PLAN_LIMITS[plan]
  switch (metric) {
    case 'api_calls':
      return l.api_calls
    case 'events':
      return l.events
    case 'storage_mb':
      return l.storage_mb
    case 'seats':
      return l.seats
    default:
      return UNLIMITED
  }
}

/** 무제한 여부. */
export const isUnlimited = (limit: number): boolean => limit === UNLIMITED

/**
 * 사용량이 한도를 초과하는지 — Desk의 enforcement 진입점.
 * @returns `{ allowed, limit, remaining }` (remaining 은 무제한이면 UNLIMITED).
 */
export function checkLimit(
  plan: Plan,
  metric: UsageMetric,
  current: number
): { allowed: boolean; limit: number; remaining: number } {
  const limit = limitFor(plan, metric)
  if (isUnlimited(limit)) return { allowed: true, limit: UNLIMITED, remaining: UNLIMITED }
  const remaining = Math.max(0, limit - current)
  return { allowed: current < limit, limit, remaining }
}
