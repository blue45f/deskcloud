/**
 * DeskCloud PlanLimit 맵 — 벤더 단일파일(zero-dep, copy-paste).
 *
 * npm publish 가 막힌 환경에서 각 Desk가 이 파일 하나를 복사해 `tenant.plan` 한도를
 * 강제할 수 있도록 의도적으로 자급자족하게 만들었다(@desk/billing 의 DESK_PLANS 와 동일한 단일 소스).
 * 값이 바뀌면 packages/billing/src/limits.ts 와 함께 갱신하라(드리프트 금지).
 *
 * 사용:
 *   import { DESK_PLANS, checkLimit, type Plan } from './plan-limits'
 *   const { allowed, softCapHit, upgradeUrl } = checkLimit({ plan: tenant.plan }, 'responses', usedThisMonth)
 */

export const PLANS = ['free', 'pro', 'scale', 'enterprise'] as const
export type Plan = (typeof PLANS)[number]

/** -1 = 제한 없음. */
export const UNLIMITED = -1

export interface PlanFeatures {
  removeBranding: boolean
  customDomain: boolean
  webhooks: boolean
}

export interface PlanDef {
  plan: Plan
  label: string
  priceKrwMonthly: number
  priceUsdCentsMonthly: number
  /** 메트릭 키 → 한도(-1=무제한). Desk 별 메트릭(responses/notifications/searches/…). */
  limits: Record<string, number>
  features: PlanFeatures
  /** 메트릭 단위 초과 과금 단가(원/단위) — 미터드 빌링(선택). */
  overagePerUnitKrw?: Record<string, number>
}

export const DESK_PLANS: Readonly<Record<Plan, PlanDef>> = {
  free: {
    plan: 'free',
    label: 'Free',
    priceKrwMonthly: 0,
    priceUsdCentsMonthly: 0,
    limits: {
      responses: 100,
      notifications: 1_000,
      searches: 5_000,
      storageBytes: 100 * 1024 * 1024,
      mediaCount: 50,
      seats: 1,
      projects: 1,
    },
    features: { removeBranding: false, customDomain: false, webhooks: false },
  },
  pro: {
    plan: 'pro',
    label: 'Pro',
    priceKrwMonthly: 29_000,
    priceUsdCentsMonthly: 1_900,
    limits: {
      responses: 10_000,
      notifications: 100_000,
      searches: 500_000,
      storageBytes: 5 * 1024 * 1024 * 1024,
      mediaCount: 5_000,
      seats: 5,
      projects: 10,
    },
    features: { removeBranding: true, customDomain: false, webhooks: true },
    overagePerUnitKrw: { responses: 5, notifications: 1 },
  },
  scale: {
    plan: 'scale',
    label: 'Scale',
    priceKrwMonthly: 99_000,
    priceUsdCentsMonthly: 7_900,
    limits: {
      responses: 100_000,
      notifications: 2_000_000,
      searches: 10_000_000,
      storageBytes: 50 * 1024 * 1024 * 1024,
      mediaCount: 100_000,
      seats: 20,
      projects: 100,
    },
    features: { removeBranding: true, customDomain: true, webhooks: true },
    overagePerUnitKrw: { responses: 3, notifications: 1 },
  },
  enterprise: {
    plan: 'enterprise',
    label: 'Enterprise',
    priceKrwMonthly: 0,
    priceUsdCentsMonthly: 0,
    limits: {
      responses: UNLIMITED,
      notifications: UNLIMITED,
      searches: UNLIMITED,
      storageBytes: UNLIMITED,
      mediaCount: UNLIMITED,
      seats: UNLIMITED,
      projects: UNLIMITED,
    },
    features: { removeBranding: true, customDomain: true, webhooks: true },
  },
}

export const isUnlimited = (limit: number): boolean => limit === UNLIMITED

export function planLimit(plan: Plan, metric: string): number {
  const v = DESK_PLANS[plan].limits[metric]
  return v === undefined ? UNLIMITED : v
}

export function nextPlanUp(plan: Plan): Plan | null {
  const i = PLANS.indexOf(plan)
  return i >= 0 && i < PLANS.length - 1 ? PLANS[i + 1]! : null
}

export interface CheckLimitResult {
  allowed: boolean
  softCapHit: boolean
  hardCapHit: boolean
  limit: number
  remaining: number
  upgradeUrl?: string
  suggestedPlan?: Plan
}

/**
 * 한도 집행 — Free 는 hard-cap(차단), 유료는 soft-cap(허용+경고). 80% 임박 시 softCapHit.
 */
export function checkLimit(
  tenant: { plan: Plan },
  metric: string,
  current: number,
  opts: { softCapRatio?: number; upgradeUrlBase?: string; allowSoftOverage?: boolean } = {}
): CheckLimitResult {
  const limit = planLimit(tenant.plan, metric)
  if (isUnlimited(limit)) {
    return { allowed: true, softCapHit: false, hardCapHit: false, limit: UNLIMITED, remaining: UNLIMITED }
  }
  const softRatio = opts.softCapRatio ?? 0.8
  const base = opts.upgradeUrlBase ?? '/billing'
  const allowSoftOverage = opts.allowSoftOverage ?? true
  const ratio = limit <= 0 ? 1 : current / limit
  const overLimit = current >= limit
  const hardCapHit = overLimit && (tenant.plan === 'free' || !allowSoftOverage)
  const softCapHit = !hardCapHit && (overLimit || ratio >= softRatio)
  const suggested = nextPlanUp(tenant.plan) ?? undefined
  const wantsUpgrade = hardCapHit || softCapHit
  return {
    allowed: !hardCapHit,
    softCapHit,
    hardCapHit,
    limit,
    remaining: Math.max(0, limit - current),
    upgradeUrl: wantsUpgrade && suggested ? `${base}?plan=${suggested}&metric=${metric}` : undefined,
    suggestedPlan: wantsUpgrade ? suggested : undefined,
  }
}

/** Free 는 배지 노출, 유료(removeBranding)는 숨김. */
export function shouldShowBadge(plan: Plan): boolean {
  return !DESK_PLANS[plan].features.removeBranding
}
