import { type Plan } from '@desk/shared'

import { DESK_PLANS, isUnlimited, planLimit, type PlanCatalog } from './limits'

/**
 * 미터드 오버리지 — 플랜 한도를 넘은 사용량을 사용량 기반 과금으로 환산한다.
 * **실제 청구는 하지 않는다**(money-movement boundary). 인보이스 미리보기·대시보드 표시용.
 */

/** 단일 메트릭 오버리지 결과. */
export interface MetricOverage {
  metric: string
  used: number
  limit: number
  /** 한도 초과 단위 수(없으면 0). */
  overUnits: number
  /** 단위당 단가(원). 카탈로그 미설정이면 0. */
  unitPriceKrw: number
  /** 오버리지 금액(원) = overUnits * unitPriceKrw. */
  amountKrw: number
}

/** 한 메트릭의 오버리지 계산. 무제한·미초과·단가없음이면 amount 0. */
export function computeMetricOverage<M extends string>(
  plan: Plan,
  metric: M,
  used: number,
  catalog: PlanCatalog<M> = DESK_PLANS as unknown as PlanCatalog<M>
): MetricOverage {
  const limit = planLimit(catalog, plan, metric)
  const unitPriceKrw = catalog[plan].overagePerUnitKrw?.[metric] ?? 0
  if (isUnlimited(limit) || used <= limit || unitPriceKrw <= 0) {
    return { metric, used, limit, overUnits: 0, unitPriceKrw, amountKrw: 0 }
  }
  const overUnits = used - limit
  return {
    metric,
    used,
    limit,
    overUnits,
    unitPriceKrw,
    amountKrw: overUnits * unitPriceKrw,
  }
}

/** 인보이스 요약 — 기본료(플랜) + 메트릭별 오버리지. */
export interface OverageInvoice {
  plan: Plan
  baseKrw: number
  lines: MetricOverage[]
  /** 오버리지 합계(원). */
  overageKrw: number
  /** 총액(원) = baseKrw + overageKrw. */
  totalKrw: number
}

/**
 * 여러 메트릭의 사용량 맵으로 오버리지 인보이스를 계산.
 * @param usage 메트릭 → 현재 사용량
 */
export function computeOverage<M extends string>(
  plan: Plan,
  usage: Partial<Record<M, number>>,
  catalog: PlanCatalog<M> = DESK_PLANS as unknown as PlanCatalog<M>
): OverageInvoice {
  const baseKrw = catalog[plan].priceKrwMonthly
  const lines: MetricOverage[] = []
  for (const [metric, used] of Object.entries(usage) as [M, number][]) {
    const line = computeMetricOverage(plan, metric, used ?? 0, catalog)
    if (line.amountKrw > 0) lines.push(line)
  }
  const overageKrw = lines.reduce((sum, l) => sum + l.amountKrw, 0)
  return { plan, baseKrw, lines, overageKrw, totalKrw: baseKrw + overageKrw }
}
