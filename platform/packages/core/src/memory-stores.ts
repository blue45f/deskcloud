import { randomUUID } from 'node:crypto'

import type {
  CreateTenantRecord,
  MemberRecord,
  MemberStore,
  TenantRecord,
  TenantStore,
  UsageStore,
} from './ports'
import type { UsageMetric } from '@desk/shared'

/**
 * 인메모리 포트 구현 — 테스트·로컬 데모·Desk 통합 레퍼런스용. 프로세스 메모리에만 산다.
 * 프로덕션은 apps/api 의 Drizzle 구현을 쓴다.
 */
export class InMemoryTenantStore implements TenantStore {
  private readonly byId = new Map<string, TenantRecord>()

  async insert(rec: CreateTenantRecord): Promise<TenantRecord> {
    const now = new Date()
    const full: TenantRecord = { id: randomUUID(), createdAt: now, updatedAt: now, ...rec }
    this.byId.set(full.id, full)
    return { ...full }
  }

  async findById(id: string): Promise<TenantRecord | null> {
    const r = this.byId.get(id)
    return r ? { ...r } : null
  }

  async findBySlug(slug: string): Promise<TenantRecord | null> {
    for (const r of this.byId.values()) if (r.slug === slug) return { ...r }
    return null
  }

  async findByPublishableKey(key: string): Promise<TenantRecord | null> {
    for (const r of this.byId.values()) if (r.publishableKey === key) return { ...r }
    return null
  }

  async findBySecretKeyHash(hash: string): Promise<TenantRecord | null> {
    for (const r of this.byId.values()) if (r.secretKeyHash === hash) return { ...r }
    return null
  }

  async update(
    id: string,
    patch: Partial<
      Pick<TenantRecord, 'name' | 'corsOrigins' | 'plan' | 'secretKeyHash' | 'publishableKey'>
    >
  ): Promise<TenantRecord | null> {
    const cur = this.byId.get(id)
    if (!cur) return null
    const next: TenantRecord = { ...cur, ...patch, updatedAt: new Date() }
    this.byId.set(id, next)
    return { ...next }
  }
}

export class InMemoryMemberStore implements MemberStore {
  private readonly rows: MemberRecord[] = []

  async insert(rec: Omit<MemberRecord, 'id' | 'createdAt'>): Promise<MemberRecord> {
    const full: MemberRecord = { id: randomUUID(), createdAt: new Date(), ...rec }
    this.rows.push(full)
    return { ...full }
  }

  async listByTenant(tenantId: string): Promise<MemberRecord[]> {
    return this.rows.filter((r) => r.tenantId === tenantId).map((r) => ({ ...r }))
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.rows.filter((r) => r.tenantId === tenantId).length
  }

  async findByEmail(tenantId: string, email: string): Promise<MemberRecord | null> {
    const r = this.rows.find((x) => x.tenantId === tenantId && x.email === email)
    return r ? { ...r } : null
  }

  async remove(tenantId: string, id: string): Promise<boolean> {
    const i = this.rows.findIndex((r) => r.tenantId === tenantId && r.id === id)
    if (i < 0) return false
    this.rows.splice(i, 1)
    return true
  }
}

export class InMemoryUsageStore implements UsageStore {
  /** key: `${tenantId}:${period}:${metric}` → count */
  private readonly counters = new Map<string, number>()

  private key(tenantId: string, period: string, metric: UsageMetric): string {
    return `${tenantId}:${period}:${metric}`
  }

  async increment(
    tenantId: string,
    period: string,
    metric: UsageMetric,
    n: number
  ): Promise<number> {
    const k = this.key(tenantId, period, metric)
    const next = (this.counters.get(k) ?? 0) + n
    this.counters.set(k, next)
    return next
  }

  async get(tenantId: string, period: string, metric: UsageMetric): Promise<number> {
    return this.counters.get(this.key(tenantId, period, metric)) ?? 0
  }

  async getAll(tenantId: string, period: string): Promise<Partial<Record<UsageMetric, number>>> {
    const prefix = `${tenantId}:${period}:`
    const out: Partial<Record<UsageMetric, number>> = {}
    for (const [k, v] of this.counters) {
      if (k.startsWith(prefix)) out[k.slice(prefix.length) as UsageMetric] = v
    }
    return out
  }

  async reset(tenantId: string, period: string, metric?: UsageMetric): Promise<void> {
    if (metric) {
      this.counters.delete(this.key(tenantId, period, metric))
      return
    }
    const prefix = `${tenantId}:${period}:`
    for (const k of [...this.counters.keys()]) if (k.startsWith(prefix)) this.counters.delete(k)
  }
}
