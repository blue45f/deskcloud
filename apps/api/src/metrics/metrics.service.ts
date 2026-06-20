import { Injectable } from '@nestjs/common'
import { type AdminStatsDto, type VisitPingInput } from '@realtimedesk/shared'
import { gte, sql } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { tenants, visits } from '../db/schema'

/** KST(Asia/Seoul) 오프셋 — UTC+9, DST 없음. 자정 경계 계산에 사용. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 운영 지표 — 방문 추적(visits 일자 버킷)과 운영 현황 집계(가입·트래픽).
 *
 * 정직성 원칙:
 * - 가입 지표는 tenants 에서 **실집계**(REAL). 시드된 데모 테넌트도 실 row 이므로 카운트된다.
 * - 트래픽 지표는 visits 에서 집계되는 **추적 누적**(tracked-new) — 추적 시작 이후만 의미가 있다.
 *
 * 오늘 경계는 서버가 KST 자정 기준으로 일관 계산한다(클라이언트 시계를 믿지 않음).
 */
@Injectable()
export class MetricsService {
  constructor(private readonly dbs: DatabaseService) {}

  /** 주어진 시각(기본 now)이 속한 KST 일자 키(YYYY-MM-DD). */
  static kstDayKey(now: Date = new Date()): string {
    // UTC 기준 ms 에 KST 오프셋을 더한 뒤 UTC 날짜 부분만 떼면 KST 달력일이 된다.
    return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
  }

  /**
   * KST 오늘 자정(=경계)에 해당하는 UTC Date.
   * created_at(timestamptz) 과 비교해 "오늘(KST) 가입" 을 거른다.
   */
  static kstTodayStartUtc(now: Date = new Date()): Date {
    const dayKey = MetricsService.kstDayKey(now) // YYYY-MM-DD (KST)
    // 그 KST 자정의 UTC 순간 = (KST 자정) - 9h.
    return new Date(new Date(`${dayKey}T00:00:00.000Z`).getTime() - KST_OFFSET_MS)
  }

  /**
   * 방문 1건 기록 — 오늘(KST) 버킷의 hit 를 +1, `unique`(세션 첫 방문)면 visitor 도 +1.
   * 멱등 누적: 같은 day 행이 있으면 UPDATE, 없으면 INSERT (ON CONFLICT).
   */
  async recordVisit(input: VisitPingInput): Promise<void> {
    const day = MetricsService.kstDayKey()
    const uniqueInc = input.firstToday ? 1 : 0
    await this.dbs.db
      .insert(visits)
      .values({ day, hits: 1, visitors: uniqueInc })
      .onConflictDoUpdate({
        target: visits.day,
        set: {
          hits: sql`${visits.hits} + 1`,
          visitors: sql`${visits.visitors} + ${uniqueInc}`,
        },
      })
  }

  /** 운영 현황 — 가입(real) + 트래픽(tracked-new) 을 단일 호출로 집계. */
  async stats(now: Date = new Date()): Promise<AdminStatsDto> {
    const todayKey = MetricsService.kstDayKey(now)
    const todayStart = MetricsService.kstTodayStartUtc(now)

    // 가입(real) — 총계 + 오늘(KST) 가입.
    const totalSignupsRows = await this.dbs.db
      .select({ count: sql<number>`count(*)` })
      .from(tenants)
    const todaySignupsRows = await this.dbs.db
      .select({ count: sql<number>`count(*)` })
      .from(tenants)
      .where(gte(tenants.createdAt, todayStart))

    // 트래픽(tracked-new) — 전체 누적 + 오늘 버킷.
    const totalTrafficRows = await this.dbs.db
      .select({
        visitors: sql<number>`coalesce(sum(${visits.visitors}), 0)`,
        hits: sql<number>`coalesce(sum(${visits.hits}), 0)`,
      })
      .from(visits)
    const todayTrafficRows = await this.dbs.db
      .select({ visitors: visits.visitors, hits: visits.hits })
      .from(visits)
      .where(sql`${visits.day} = ${todayKey}`)
      .limit(1)

    const todayTraffic = todayTrafficRows[0]

    return {
      signups: {
        today: num(todaySignupsRows[0]?.count),
        total: num(totalSignupsRows[0]?.count),
      },
      traffic: {
        todayVisitors: num(todayTraffic?.visitors),
        totalVisitors: num(totalTrafficRows[0]?.visitors),
        todayHits: num(todayTraffic?.hits),
        totalHits: num(totalTrafficRows[0]?.hits),
      },
    }
  }
}

/** count()/sum() 은 드라이버에 따라 string 으로 올 수 있어 안전하게 정수화한다. */
function num(v: number | string | null | undefined): number {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}
