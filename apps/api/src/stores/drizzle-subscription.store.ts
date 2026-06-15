import {
  type BillingProvider,
  emptySubscription,
  type Subscription,
  type SubscriptionStatusValue,
} from '@desk/billing'
import { type Plan } from '@desk/shared'
import { eq } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { subscriptions } from '../db/schema'

type Row = typeof subscriptions.$inferSelect

function toSub(row: Row): Subscription {
  return {
    tenantId: row.tenantId,
    plan: row.plan,
    status: row.status as SubscriptionStatusValue,
    provider: row.provider as BillingProvider,
    providerSubscriptionId: row.providerSubscriptionId,
    periodEnd: row.periodEnd ? row.periodEnd.toISOString() : null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** 구독 영속화 — 테넌트당 1개. upsert(get-or-create) + save. */
export class DrizzleSubscriptionStore {
  constructor(private readonly dbs: DatabaseService) {}

  /** 조회(없으면 null). */
  async find(tenantId: string): Promise<Subscription | null> {
    const rows = await this.dbs.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .limit(1)
    return rows[0] ? toSub(rows[0]) : null
  }

  /** 조회 또는 기본(none/Free) 생성. */
  async getOrCreate(tenantId: string, provider: BillingProvider): Promise<Subscription> {
    const found = await this.find(tenantId)
    if (found) return found
    const fresh = emptySubscription(tenantId, provider)
    const inserted = await this.dbs.db
      .insert(subscriptions)
      .values({
        tenantId: fresh.tenantId,
        plan: fresh.plan,
        status: fresh.status,
        provider: fresh.provider,
        providerSubscriptionId: fresh.providerSubscriptionId,
        periodEnd: fresh.periodEnd ? new Date(fresh.periodEnd) : null,
        cancelAtPeriodEnd: fresh.cancelAtPeriodEnd,
      })
      .onConflictDoNothing({ target: subscriptions.tenantId })
      .returning()
    if (inserted[0]) return toSub(inserted[0])
    // 동시 삽입 레이스 — 다시 조회.
    return (await this.find(tenantId)) ?? fresh
  }

  /** 상태 저장(upsert by tenantId). */
  async save(sub: Subscription): Promise<Subscription> {
    const values = {
      tenantId: sub.tenantId,
      plan: sub.plan as Plan,
      status: sub.status,
      provider: sub.provider,
      providerSubscriptionId: sub.providerSubscriptionId,
      periodEnd: sub.periodEnd ? new Date(sub.periodEnd) : null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      updatedAt: new Date(),
    }
    const rows = await this.dbs.db
      .insert(subscriptions)
      .values(values)
      .onConflictDoUpdate({
        target: subscriptions.tenantId,
        set: {
          plan: values.plan,
          status: values.status,
          provider: values.provider,
          providerSubscriptionId: values.providerSubscriptionId,
          periodEnd: values.periodEnd,
          cancelAtPeriodEnd: values.cancelAtPeriodEnd,
          updatedAt: values.updatedAt,
        },
      })
      .returning()
    return toSub(rows[0]!)
  }
}
