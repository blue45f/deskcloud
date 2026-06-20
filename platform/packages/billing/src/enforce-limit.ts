import { UNLIMITED, type Plan } from '@desk/shared'

import {
  DESK_PLANS,
  isUnlimited,
  nextPlanUp,
  planLimit,
  type PlanCatalog,
} from './limits'

/**
 * 한도 집행(Desk 범용) — soft-cap(경고/업그레이드 유도) vs hard-cap(차단) 모델.
 *
 * 정책:
 *  - **hard cap**: Free 플랜은 한도 도달 시 즉시 차단(allowed=false). 결제 유도가 목적.
 *  - **soft cap**: 유료(Pro+) 플랜은 한도를 넘어도 차단하지 않고(allowed=true) softCapHit=true 로
 *    경고만 — 초과분은 미터드 오버리지로 과금(computeOverage). 서비스 중단보다 매출/UX 우선.
 *  - 임박 경고: 한도의 `softCapRatio`(기본 0.8) 이상이면 softCapHit=true(업그레이드 프롬프트).
 *  - 무제한(enterprise): 항상 allowed, softCapHit=false.
 */

/** 한도를 가진 테넌트 최소 형태(plan 만 있으면 됨). */
export interface PlanBearer {
  plan: Plan
}

export interface CheckLimitOptions<M extends string> {
  /** Desk 플랜 카탈로그(미지정 시 DeskCloud 표준 DESK_PLANS). */
  catalog?: PlanCatalog<M>
  /** soft-cap 경고 임계 비율(0~1, 기본 0.8). 이 비율 이상이면 softCapHit. */
  softCapRatio?: number
  /** 업그레이드 URL 베이스(기본 '/billing'). 결과 upgradeUrl 에 ?plan= 부착. */
  upgradeUrlBase?: string
  /** 유료 플랜에서 한도 초과를 허용(soft-cap)할지. 기본 true(매출 우선). */
  allowSoftOverage?: boolean
}

export interface CheckLimitResult {
  /** 작업 허용 여부. Free hard-cap 초과면 false. */
  allowed: boolean
  /** 경고/업그레이드 프롬프트를 띄워야 하는지(임박 또는 soft 초과). */
  softCapHit: boolean
  /** hard-cap 으로 차단되었는지(allowed=false 의 사유 구분). */
  hardCapHit: boolean
  plan: Plan
  metric: string
  used: number
  limit: number
  /** 남은 허용량(무제한이면 -1). */
  remaining: number
  /** 0~1, 사용 비율(무제한이면 0). */
  ratio: number
  /** 업그레이드로 보낼 URL(있을 때만). */
  upgradeUrl?: string
  /** 권장 업그레이드 대상 플랜. */
  suggestedPlan?: Plan
  /** 사람이 읽는 사유(차단/경고 시). */
  reason?: string
}

const DEFAULT_SOFT_RATIO = 0.8

/**
 * 핵심 집행 함수 — `checkLimit(tenant, metric, current)`.
 * @param tenant plan 을 가진 테넌트
 * @param metric Desk 메트릭 키
 * @param current 현재 사용량
 */
export function checkLimit<M extends string>(
  tenant: PlanBearer,
  metric: M,
  current: number,
  options: CheckLimitOptions<M> = {}
): CheckLimitResult {
  const catalog = (options.catalog ?? (DESK_PLANS as unknown as PlanCatalog<M>))
  const softRatio = options.softCapRatio ?? DEFAULT_SOFT_RATIO
  const allowSoftOverage = options.allowSoftOverage ?? true
  const base = options.upgradeUrlBase ?? '/billing'
  const { plan } = tenant
  const limit = planLimit(catalog, plan, metric)

  if (isUnlimited(limit)) {
    return {
      allowed: true,
      softCapHit: false,
      hardCapHit: false,
      plan,
      metric,
      used: current,
      limit: UNLIMITED,
      remaining: UNLIMITED,
      ratio: 0,
    }
  }

  const ratio = limit <= 0 ? 1 : current / limit
  const overLimit = current >= limit
  const isFree = plan === 'free'
  // Free 는 hard-cap, 유료는 soft-cap(allowSoftOverage 면 초과 허용).
  const hardCapHit = overLimit && (isFree || !allowSoftOverage)
  const allowed = !hardCapHit
  const nearCap = ratio >= softRatio
  const softCapHit = !hardCapHit && (overLimit || nearCap)

  const suggestedPlan = nextPlanUp(plan) ?? undefined
  const wantsUpgrade = hardCapHit || softCapHit
  const upgradeUrl =
    wantsUpgrade && suggestedPlan ? `${base}?plan=${suggestedPlan}&metric=${metric}` : undefined

  let reason: string | undefined
  if (hardCapHit) {
    reason = `'${plan}' 플랜의 ${metric} 한도(${limit})에 도달했습니다. 계속하려면 업그레이드하세요.`
  } else if (softCapHit && overLimit) {
    reason = `${metric} 한도(${limit})를 초과했습니다 — 초과분은 추가 과금됩니다. 업그레이드를 권장합니다.`
  } else if (softCapHit) {
    reason = `${metric} 사용량이 한도(${limit})의 ${Math.round(ratio * 100)}%에 도달했습니다.`
  }

  return {
    allowed,
    softCapHit,
    hardCapHit,
    plan,
    metric,
    used: current,
    limit,
    remaining: Math.max(0, limit - current),
    ratio,
    upgradeUrl,
    suggestedPlan: wantsUpgrade ? suggestedPlan : undefined,
    reason,
  }
}
