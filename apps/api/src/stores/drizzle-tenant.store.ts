import type {
  CreateTenantRecord,
  TenantRecord,
  TenantStore,
} from '@desk/core'
import { eq } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { tenants } from '../db/schema'

type Row = typeof tenants.$inferSelect

function toRecord(row: Row): TenantRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    publishableKey: row.publishableKey,
    secretKeyHash: row.secretKeyHash,
    corsOrigins: row.corsOrigins,
    plan: row.plan,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** core 의 TenantStore 포트를 Drizzle 로 구현. */
export class DrizzleTenantStore implements TenantStore {
  constructor(private readonly dbs: DatabaseService) {}

  async insert(rec: CreateTenantRecord): Promise<TenantRecord> {
    const inserted = await this.dbs.db
      .insert(tenants)
      .values({
        name: rec.name,
        slug: rec.slug,
        publishableKey: rec.publishableKey,
        secretKeyHash: rec.secretKeyHash,
        corsOrigins: rec.corsOrigins,
        plan: rec.plan,
      })
      .returning()
    return toRecord(inserted[0]!)
  }

  async findById(id: string): Promise<TenantRecord | null> {
    const rows = await this.dbs.db.select().from(tenants).where(eq(tenants.id, id)).limit(1)
    return rows[0] ? toRecord(rows[0]) : null
  }

  async findBySlug(slug: string): Promise<TenantRecord | null> {
    const rows = await this.dbs.db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1)
    return rows[0] ? toRecord(rows[0]) : null
  }

  async findByPublishableKey(key: string): Promise<TenantRecord | null> {
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .where(eq(tenants.publishableKey, key))
      .limit(1)
    return rows[0] ? toRecord(rows[0]) : null
  }

  async findBySecretKeyHash(hash: string): Promise<TenantRecord | null> {
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .where(eq(tenants.secretKeyHash, hash))
      .limit(1)
    return rows[0] ? toRecord(rows[0]) : null
  }

  async update(
    id: string,
    patch: Partial<
      Pick<TenantRecord, 'name' | 'corsOrigins' | 'plan' | 'secretKeyHash' | 'publishableKey'>
    >
  ): Promise<TenantRecord | null> {
    const updated = await this.dbs.db
      .update(tenants)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning()
    return updated[0] ? toRecord(updated[0]) : null
  }
}
