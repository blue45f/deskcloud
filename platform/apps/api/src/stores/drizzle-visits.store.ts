import { type VisitStatsDto } from '@desk/shared'
import { eq, sql } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { dailyVisits } from '../db/schema'
import { type PingVisitRecord, type VisitsStorePort } from '../visits/tokens'

/** core/billing/usage 스토어와 동일한 port/adapter 패턴 — 방문 집계 영속화(Drizzle). */
export class DrizzleVisitsStore implements VisitsStorePort {
  constructor(private readonly dbs: DatabaseService) {}

  /** 오늘 (appId, day) 버킷을 원자적으로 증가 — usage 스토어의 upsert 패턴과 동일. */
  async ping(rec: PingVisitRecord): Promise<void> {
    const uniqueInc = rec.newVisitor ? 1 : 0
    // (appId, day) 충돌 시 visits += 1, uniques += uniqueInc. Postgres/PGlite 공통 ON CONFLICT.
    await this.dbs.db
      .insert(dailyVisits)
      .values({ appId: rec.appId, day: rec.day, visits: 1, uniques: uniqueInc })
      .onConflictDoUpdate({
        target: [dailyVisits.appId, dailyVisits.day],
        set: {
          visits: sql`${dailyVisits.visits} + 1`,
          uniques: sql`${dailyVisits.uniques} + ${uniqueInc}`,
          updatedAt: new Date(),
        },
      })
  }

  /** 앱별 집계 — 오늘(day 일치) + 전체(SUM). 데이터 없으면 0. */
  async stats(appId: string, day: string): Promise<VisitStatsDto> {
    const rows = await this.dbs.db
      .select({
        todayVisits: sql<number>`coalesce(sum(case when ${dailyVisits.day} = ${day} then ${dailyVisits.visits} else 0 end), 0)`,
        todayUniques: sql<number>`coalesce(sum(case when ${dailyVisits.day} = ${day} then ${dailyVisits.uniques} else 0 end), 0)`,
        totalVisits: sql<number>`coalesce(sum(${dailyVisits.visits}), 0)`,
        totalUniques: sql<number>`coalesce(sum(${dailyVisits.uniques}), 0)`,
      })
      .from(dailyVisits)
      .where(eq(dailyVisits.appId, appId))
    const agg = rows[0]
    return {
      appId,
      day,
      todayVisits: Number(agg?.todayVisits ?? 0),
      todayUniques: Number(agg?.todayUniques ?? 0),
      totalVisits: Number(agg?.totalVisits ?? 0),
      totalUniques: Number(agg?.totalUniques ?? 0),
    }
  }
}
