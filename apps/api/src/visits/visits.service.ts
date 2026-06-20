import { Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'

interface VisitTotals {
  totalTraffic: number
  todayVisitors: number
  todayHits: number
  trafficSince: string | null
}

/**
 * 방문 집계 — 일별 버킷(visits) 에 멱등 UPSERT 한다.
 * hits 는 매 핑마다 +1, visitors 는 클라이언트가 "오늘 첫 방문"이라고 보고할 때만 +1.
 * IP/쿠키를 저장하지 않으므로 visitors 는 advisory(브라우저 localStorage 플래그 기반)다.
 */
@Injectable()
export class VisitsService {
  constructor(private readonly dbs: DatabaseService) {}

  /**
   * 방문 1건 기록. uniqueToday=true 면 고유 방문자도 +1.
   * day 는 DB 의 current_date 로 채워 overview 집계(current_date 기준)와 정확히 정렬한다.
   */
  async recordVisit(uniqueToday: boolean): Promise<void> {
    const visitorInc = uniqueToday ? 1 : 0
    await this.dbs.db.execute(sql`
      INSERT INTO visits (day, visitors, hits)
      VALUES (current_date, ${visitorInc}, 1)
      ON CONFLICT (day) DO UPDATE
        SET hits = visits.hits + 1,
            visitors = visits.visitors + ${visitorInc}
    `)
  }

  /** 운영 overview 에 들어갈 방문 합계(누적·오늘·집계 시작일). */
  async totals(): Promise<VisitTotals> {
    const rows = (await this.dbs.db.execute(sql`
      SELECT
        coalesce(sum(hits), 0)::int AS total_traffic,
        coalesce(max(case when day = current_date then visitors end), 0)::int AS today_visitors,
        coalesce(max(case when day = current_date then hits end), 0)::int AS today_hits,
        min(day)::text AS traffic_since
      FROM visits
    `)) as unknown as {
      rows?: VisitTotalsRow[]
    }
    const row = (rows.rows ?? (rows as unknown as VisitTotalsRow[]))[0]
    return {
      totalTraffic: Number(row?.total_traffic ?? 0),
      todayVisitors: Number(row?.today_visitors ?? 0),
      todayHits: Number(row?.today_hits ?? 0),
      trafficSince: row?.traffic_since ?? null,
    }
  }
}

interface VisitTotalsRow {
  total_traffic: number | string
  today_visitors: number | string
  today_hits: number | string
  traffic_since: string | null
}

export type { VisitTotals }
