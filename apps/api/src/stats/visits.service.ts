import { Injectable } from '@nestjs/common'
import { type PlatformStatsDto } from '@searchdesk/shared'
import { gte, sql } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { tenants, visits } from '../db/schema'

/** 서버 로컬 TZ 기준 오늘 날짜 'YYYY-MM-DD'. visits 일별 버킷 키. */
function todayKey(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 서버 로컬 TZ 기준 오늘 0시(가입 '오늘' 경계). */
function startOfToday(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * 트래픽/방문자 추적 + 플랫폼 현황 집계.
 *  - recordVisit: 오늘 버킷에 원자적 UPSERT(누적 +1, 신규 방문자면 고유 +1). Postgres·PGlite 동일.
 *  - getPlatformStats: 트래픽(visits)·가입(tenants) 실측 집계.
 */
@Injectable()
export class VisitsService {
  constructor(private readonly dbs: DatabaseService) {}

  /**
   * 오늘 방문 1건 기록. 원자적 UPSERT(ON CONFLICT) 라 동시성에 안전하다.
   * `visitorIsNew` 면 그 날 최초 방문 쿠키 → unique_visitors 도 +1.
   */
  async recordVisit({ visitorIsNew }: { visitorIsNew: boolean }): Promise<void> {
    const day = todayKey()
    const uniqueDelta = visitorIsNew ? 1 : 0
    await this.dbs.db.execute(sql`
      INSERT INTO visits (day, total_visits, unique_visitors)
      VALUES (${day}, 1, ${uniqueDelta})
      ON CONFLICT (day) DO UPDATE SET
        total_visits = visits.total_visits + 1,
        unique_visitors = visits.unique_visitors + ${uniqueDelta}
    `)
  }

  /**
   * 플랫폼 현황 — 실측 집계.
   *  - totalTraffic  = SUM(visits.total_visits)
   *  - todayVisitors = 오늘 버킷 unique_visitors(없으면 0)
   *  - totalSignups  = tenants COUNT(*)
   *  - todaySignups  = tenants WHERE created_at >= 오늘 0시
   */
  async getPlatformStats(): Promise<PlatformStatsDto> {
    const day = todayKey()

    const trafficRows = await this.dbs.db
      .select({
        total: sql<number>`coalesce(sum(${visits.totalVisits}), 0)::int`,
        today: sql<number>`coalesce(sum(${visits.uniqueVisitors}) filter (where ${visits.day} = ${day}), 0)::int`,
      })
      .from(visits)
    const traffic = trafficRows[0] ?? { total: 0, today: 0 }

    const totalSignupRows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(tenants)
    const totalSignups = Number(totalSignupRows[0]?.c ?? 0)

    const todaySignupRows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(tenants)
      .where(gte(tenants.createdAt, startOfToday()))
    const todaySignups = Number(todaySignupRows[0]?.c ?? 0)

    return {
      totalSignups,
      todaySignups,
      totalTraffic: Number(traffic.total ?? 0),
      todayVisitors: Number(traffic.today ?? 0),
      asOf: new Date().toISOString(),
    }
  }
}
