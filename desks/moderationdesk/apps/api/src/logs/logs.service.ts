import { type AdminLogQuery, type LogListDto } from '@moderationdesk/shared'
import { Injectable } from '@nestjs/common'
import { and, desc, eq, sql, type SQL } from 'drizzle-orm'

import { toLogDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { moderationLogs } from '../db/schema'
import { type TenantRow } from '../tenants/tenants.service'

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 25

function clampLimit(limit: number | undefined, fallback: number): number {
  if (limit === undefined) return fallback
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)))
}

@Injectable()
export class LogsService {
  constructor(private readonly dbs: DatabaseService) {}

  /** 모더레이션 로그 목록(필터 + 페이지네이션, 최신순). */
  async listLogs(tenant: TenantRow, query: AdminLogQuery): Promise<LogListDto> {
    const offset = Math.max(0, Math.trunc(query.offset ?? 0))
    const limit = clampLimit(query.limit, DEFAULT_LIMIT)

    const conditions: SQL[] = [eq(moderationLogs.tenantId, tenant.id)]
    if (query.verdict) conditions.push(eq(moderationLogs.verdict, query.verdict))
    const where = and(...conditions)

    const totalRows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(moderationLogs)
      .where(where)
    const total = Number(totalRows[0]?.c ?? 0)

    const rows = await this.dbs.db
      .select()
      .from(moderationLogs)
      .where(where)
      .orderBy(desc(moderationLogs.createdAt))
      .offset(offset)
      .limit(limit)

    return { items: rows.map(toLogDto), total, offset, limit }
  }
}
