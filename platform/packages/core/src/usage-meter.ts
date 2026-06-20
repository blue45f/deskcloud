import {
  USAGE_METRICS,
  checkLimit,
  type Plan,
  type UsageMetric,
} from '@desk/shared'

import type { UsageStore } from './ports'

/** 'current' 를 현재 UTC 달('YYYY-MM')로 해석. 그 외 값은 그대로 사용. */
export function resolvePeriod(period: string): string {
  if (period !== 'current') return period
  const now = new Date()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${now.getUTCFullYear()}-${mm}`
}

/**
 * 사용량 미터 — record/getUsage/reset. UsageStore 포트 위에서 동작(프레임워크 무관).
 * Desk 는 이 미터로 사용량을 기록하고 플랜 한도를 강제한다.
 */
export class UsageMeter {
  constructor(private readonly store: UsageStore) {}

  /** 메트릭을 n(기본 1) 만큼 기록하고 누적값을 반환. */
  async record(
    tenantId: string,
    metric: UsageMetric,
    n = 1,
    period = 'current'
  ): Promise<number> {
    if (n <= 0) return this.store.get(tenantId, resolvePeriod(period), metric)
    return this.store.increment(tenantId, resolvePeriod(period), metric, n)
  }

  /** 단일 메트릭의 현재 사용량. */
  async getMetric(tenantId: string, metric: UsageMetric, period = 'current'): Promise<number> {
    return this.store.get(tenantId, resolvePeriod(period), metric)
  }

  /** 기간 내 모든 메트릭의 사용량 맵(미기록 메트릭은 0). */
  async getUsage(
    tenantId: string,
    period = 'current'
  ): Promise<Record<UsageMetric, number>> {
    const raw = await this.store.getAll(tenantId, resolvePeriod(period))
    const out = {} as Record<UsageMetric, number>
    for (const m of USAGE_METRICS) out[m] = raw[m] ?? 0
    return out
  }

  /** 기간 내 메트릭(들) 리셋. */
  async reset(tenantId: string, period = 'current', metric?: UsageMetric): Promise<void> {
    await this.store.reset(tenantId, resolvePeriod(period), metric)
  }

  /**
   * 한도 집행용 — 메트릭 기록 *전에* 호출해 허용 여부를 본다(플랜 한도 대비 현재 사용량).
   * Desk 의 enforcement 진입점: 막혔으면 record 하지 않고 거절한다.
   */
  async checkAllowed(
    tenantId: string,
    plan: Plan,
    metric: UsageMetric,
    period = 'current'
  ): Promise<{ allowed: boolean; used: number; limit: number; remaining: number }> {
    const used = await this.getMetric(tenantId, metric, period)
    const { allowed, limit, remaining } = checkLimit(plan, metric, used)
    return { allowed, used, limit, remaining }
  }
}
