import type { UsageMetric } from '@desk/shared'
import type { UsageStore } from '@desk/core'
import { and, eq, sql } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { usageCounters } from '../db/schema'

/** core 의 UsageStore 포트를 Drizzle 로 구현 — upsert 로 원자적 증가. */
export class DrizzleUsageStore implements UsageStore {
  constructor(private readonly dbs: DatabaseService) {}

  async increment(
    tenantId: string,
    period: string,
    metric: UsageMetric,
    n: number
  ): Promise<number> {
    // (tenantId, period, metric) 충돌 시 count += n. Postgre/PGlite 공통 ON CONFLICT.
    const rows = await this.dbs.db
      .insert(usageCounters)
      .values({ tenantId, period, metric, count: n })
      .onConflictDoUpdate({
        target: [usageCounters.tenantId, usageCounters.period, usageCounters.metric],
        set: { count: sql`${usageCounters.count} + ${n}`, updatedAt: new Date() },
      })
      .returning({ count: usageCounters.count })
    return Number(rows[0]?.count ?? n)
  }

  async get(tenantId: string, period: string, metric: UsageMetric): Promise<number> {
    const rows = await this.dbs.db
      .select({ count: usageCounters.count })
      .from(usageCounters)
      .where(
        and(
          eq(usageCounters.tenantId, tenantId),
          eq(usageCounters.period, period),
          eq(usageCounters.metric, metric)
        )
      )
      .limit(1)
    return Number(rows[0]?.count ?? 0)
  }

  async getAll(
    tenantId: string,
    period: string
  ): Promise<Partial<Record<UsageMetric, number>>> {
    const rows = await this.dbs.db
      .select({ metric: usageCounters.metric, count: usageCounters.count })
      .from(usageCounters)
      .where(and(eq(usageCounters.tenantId, tenantId), eq(usageCounters.period, period)))
    const out: Partial<Record<UsageMetric, number>> = {}
    for (const r of rows) out[r.metric] = Number(r.count)
    return out
  }

  async reset(tenantId: string, period: string, metric?: UsageMetric): Promise<void> {
    const base = and(eq(usageCounters.tenantId, tenantId), eq(usageCounters.period, period))
    await this.dbs.db
      .delete(usageCounters)
      .where(metric ? and(base, eq(usageCounters.metric, metric)) : base)
  }
}
