import type { MemberRecord, MemberStore } from '@desk/core'
import { and, eq, sql } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { members } from '../db/schema'

type Row = typeof members.$inferSelect

const toRecord = (row: Row): MemberRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  email: row.email,
  role: row.role,
  createdAt: row.createdAt,
})

/** core 의 MemberStore 포트를 Drizzle 로 구현. */
export class DrizzleMemberStore implements MemberStore {
  constructor(private readonly dbs: DatabaseService) {}

  async insert(rec: Omit<MemberRecord, 'id' | 'createdAt'>): Promise<MemberRecord> {
    const inserted = await this.dbs.db
      .insert(members)
      .values({ tenantId: rec.tenantId, email: rec.email, role: rec.role })
      .returning()
    return toRecord(inserted[0]!)
  }

  async listByTenant(tenantId: string): Promise<MemberRecord[]> {
    const rows = await this.dbs.db.select().from(members).where(eq(members.tenantId, tenantId))
    return rows.map(toRecord)
  }

  async countByTenant(tenantId: string): Promise<number> {
    const rows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(members)
      .where(eq(members.tenantId, tenantId))
    return Number(rows[0]?.c ?? 0)
  }

  async findByEmail(tenantId: string, email: string): Promise<MemberRecord | null> {
    const rows = await this.dbs.db
      .select()
      .from(members)
      .where(and(eq(members.tenantId, tenantId), eq(members.email, email)))
      .limit(1)
    return rows[0] ? toRecord(rows[0]) : null
  }

  async remove(tenantId: string, id: string): Promise<boolean> {
    const deleted = await this.dbs.db
      .delete(members)
      .where(and(eq(members.tenantId, tenantId), eq(members.id, id)))
      .returning({ id: members.id })
    return deleted.length > 0
  }
}
