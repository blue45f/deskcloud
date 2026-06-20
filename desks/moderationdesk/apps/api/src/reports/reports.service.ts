import {
  type AdminReportQuery,
  type ReportDto,
  type ReportListDto,
  type ReportReceiptDto,
  type SubmitReportInput,
  type UpdateReportInput,
} from '@moderationdesk/shared'
import { Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, sql, type SQL } from 'drizzle-orm'

import { toReportDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { reports } from '../db/schema'
import { type TenantRow } from '../tenants/tenants.service'

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 25

function clampLimit(limit: number | undefined, fallback: number): number {
  if (limit === undefined) return fallback
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)))
}

@Injectable()
export class ReportsService {
  constructor(private readonly dbs: DatabaseService) {}

  // ── 공개(publishable) ───────────────────────────────────────────────────────

  /** 공개 신고 접수 — 상태는 항상 open 으로 시작. 영수증(id·status)만 반환. */
  async submitReport(tenant: TenantRow, input: SubmitReportInput): Promise<ReportReceiptDto> {
    const inserted = await this.dbs.db
      .insert(reports)
      .values({
        tenantId: tenant.id,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        reason: input.reason,
        reporterId: input.reporterId ?? null,
        status: 'open',
      })
      .returning()
    const row = inserted[0]!
    return { id: row.id, status: row.status, createdAt: row.createdAt.toISOString() }
  }

  // ── 어드민(secret/글로벌 토큰) ───────────────────────────────────────────────

  /** 신고 목록(필터 + 페이지네이션, 최신순). */
  async listReports(tenant: TenantRow, query: AdminReportQuery): Promise<ReportListDto> {
    const offset = Math.max(0, Math.trunc(query.offset ?? 0))
    const limit = clampLimit(query.limit, DEFAULT_LIMIT)

    const conditions: SQL[] = [eq(reports.tenantId, tenant.id)]
    if (query.status) conditions.push(eq(reports.status, query.status))
    if (query.subjectType) conditions.push(eq(reports.subjectType, query.subjectType))
    const where = and(...conditions)

    const totalRows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(reports)
      .where(where)
    const total = Number(totalRows[0]?.c ?? 0)

    const rows = await this.dbs.db
      .select()
      .from(reports)
      .where(where)
      .orderBy(desc(reports.createdAt))
      .offset(offset)
      .limit(limit)

    return { items: rows.map(toReportDto), total, offset, limit }
  }

  /**
   * 신고 갱신 — 상태 전이 그리고/또는 메모. 상태 전이는 멱등(같은 상태로 재설정 무해).
   * 타 테넌트/없음이면 404.
   */
  async updateReport(tenant: TenantRow, id: string, input: UpdateReportInput): Promise<ReportDto> {
    await this.findOwned(tenant.id, id)
    const patch: Partial<typeof reports.$inferInsert> = {}
    if (input.status !== undefined) patch.status = input.status
    if (input.notes !== undefined) patch.notes = input.notes ?? null

    const updated = await this.dbs.db
      .update(reports)
      .set(patch)
      .where(and(eq(reports.tenantId, tenant.id), eq(reports.id, id)))
      .returning()
    return toReportDto(updated[0]!)
  }

  /** 테넌트 소유 신고 조회(없거나 타 테넌트면 404). */
  private async findOwned(tenantId: string, id: string): Promise<typeof reports.$inferSelect> {
    const rows = await this.dbs.db
      .select()
      .from(reports)
      .where(and(eq(reports.tenantId, tenantId), eq(reports.id, id)))
      .limit(1)
    if (!rows[0]) throw new NotFoundException('신고를 찾을 수 없습니다')
    return rows[0]
  }
}
