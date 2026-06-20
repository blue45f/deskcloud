import { checkLimit, type Plan, type UsageMetric } from '@desk/shared'

/**
 * 한도 집행 헬퍼 — Desk가 작업 *전에* 호출해 플랜 한도를 강제한다.
 * core 의 UsageMeter 와 함께 쓰여 "현재 사용량 + 플랜"으로 허용/거절을 결정한다.
 */

export interface EnforceResult {
  allowed: boolean
  metric: UsageMetric
  plan: Plan
  used: number
  limit: number
  remaining: number
  /** 거절 시 사람이 읽는 사유(업그레이드 유도). */
  reason?: string
}

/**
 * 사용량(used) + 플랜으로 메트릭 한도를 집행한다.
 * @returns allowed=false 면 Desk 는 작업을 거절하고 reason(업그레이드 안내)을 노출한다.
 */
export function enforce(plan: Plan, metric: UsageMetric, used: number): EnforceResult {
  const { allowed, limit, remaining } = checkLimit(plan, metric, used)
  return {
    allowed,
    metric,
    plan,
    used,
    limit,
    remaining,
    reason: allowed
      ? undefined
      : `'${plan}' 플랜의 ${metric} 한도(${limit})에 도달했습니다. 상위 플랜으로 업그레이드하세요.`,
  }
}
