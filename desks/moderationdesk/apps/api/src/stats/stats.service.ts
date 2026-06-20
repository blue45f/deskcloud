import { type StatsDto } from '@moderationdesk/shared'
import { Injectable } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'

import { type AuthScope } from '../common/tenant-context'
import { DatabaseService } from '../db/database.service'
import { moderationLogs, reports, tenants } from '../db/schema'
import { type TenantRow } from '../tenants/tenants.service'

/**
 * 대시보드 트래픽/애널리틱스 집계.
 *
 * 정직성 모델(전부 실데이터 집계):
 *  - **트래픽** = moderation_logs 행 수(검사=요청/활동 이벤트). 대상 테넌트 기준.
 *    오늘 = createdAt ≥ 서버 자정. cross-check: tenants.usageCount 와 일치.
 *  - **방문자(오늘)** = 고유 사용자 신원이 없어 정밀 산출 불가 → 오늘의 distinct actor
 *    (reports.reporterId ∪ moderation_logs.source) 근사치. estimated:true 로 표기.
 *  - **가입** = tenants 행. operator 스코프면 플랫폼 전체, tenant 스코프면 본인(today 0/1, total 1).
 */
@Injectable()
export class StatsService {
  constructor(private readonly dbs: DatabaseService) {}

  /** 서버 타임존 기준 오늘 0시(date_trunc('day', now())). pg/PGlite 공통. */
  private get startOfToday() {
    return sql`date_trunc('day', now())`
  }

  /** 대상 테넌트(+ 스코프)에 대한 대시보드 요약. */
  async getStats(tenant: TenantRow, scope: AuthScope): Promise<StatsDto> {
    const [traffic, visitors, signups] = await Promise.all([
      this.traffic(tenant.id),
      this.visitorsToday(tenant.id),
      this.signups(tenant.id, scope),
    ])
    return { scope, traffic, visitors, signups }
  }

  /** 총·오늘 트래픽 = moderation_logs 행 수(대상 테넌트). */
  private async traffic(tenantId: string): Promise<StatsDto['traffic']> {
    const rows = await this.dbs.db
      .select({
        total: sql<number>`count(*)::int`,
        today: sql<number>`count(*) filter (where ${moderationLogs.createdAt} >= ${this.startOfToday})::int`,
      })
      .from(moderationLogs)
      .where(eq(moderationLogs.tenantId, tenantId))
    const row = rows[0]
    return { total: Number(row?.total ?? 0), today: Number(row?.today ?? 0) }
  }

  /**
   * 오늘 방문자(근사) = 오늘의 distinct actor 수.
   * - moderation_logs: source(없으면 'unknown') 의 distinct
   * - reports: reporterId 의 distinct(있을 때만)
   * 두 집합을 합집합 카운트(중복 제거)해 "오늘 활동한 서로 다른 출처/신고자" 근사치를 만든다.
   */
  private async visitorsToday(tenantId: string): Promise<StatsDto['visitors']> {
    const res = await this.dbs.db.execute(sql`
      SELECT count(*)::int AS count FROM (
        SELECT DISTINCT coalesce(${moderationLogs.source}, 'unknown') AS actor
        FROM ${moderationLogs}
        WHERE ${moderationLogs.tenantId} = ${tenantId}
          AND ${moderationLogs.createdAt} >= ${this.startOfToday}
        UNION
        SELECT DISTINCT ${reports.reporterId} AS actor
        FROM ${reports}
        WHERE ${reports.tenantId} = ${tenantId}
          AND ${reports.reporterId} IS NOT NULL
          AND ${reports.createdAt} >= ${this.startOfToday}
      ) AS actors
    `)
    const today = Number(this.firstRow<{ count: number }>(res)?.count ?? 0)
    return { today, estimated: true, source: 'distinct sources today' }
  }

  /**
   * 가입.
   * - operator 스코프: tenants 전체(플랫폼). total = count(*), today = createdAt ≥ 자정.
   * - tenant 스코프: 대상 테넌트 본인만. total = 1, today = (오늘 가입이면 1, 아니면 0).
   */
  private async signups(tenantId: string, scope: AuthScope): Promise<StatsDto['signups']> {
    if (scope === 'operator') {
      const rows = await this.dbs.db
        .select({
          total: sql<number>`count(*)::int`,
          today: sql<number>`count(*) filter (where ${tenants.createdAt} >= ${this.startOfToday})::int`,
        })
        .from(tenants)
      const row = rows[0]
      return {
        total: Number(row?.total ?? 0),
        today: Number(row?.today ?? 0),
        operatorOnly: false,
      }
    }

    // tenant 스코프 — 본인 가입만(타 테넌트 수치 노출 금지).
    const rows = await this.dbs.db
      .select({
        today: sql<number>`count(*) filter (where ${tenants.createdAt} >= ${this.startOfToday})::int`,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
    return { total: 1, today: Number(rows[0]?.today ?? 0), operatorOnly: true }
  }

  /** execute 결과(pg: {rows}, PGlite: 배열-유사) 에서 첫 행을 꺼낸다. */
  private firstRow<T>(res: unknown): T | undefined {
    const rows = (res as { rows?: T[] }).rows ?? (res as T[])
    return Array.isArray(rows) ? rows[0] : undefined
  }
}
