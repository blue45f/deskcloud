import { type StatsOverviewDto } from '@filedesk/shared'
import { Inject, Injectable } from '@nestjs/common'
import { eq, gte, sql } from 'drizzle-orm'

import { visitorHash } from '../common/secret'
import { APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { siteVisitDays, siteVisitors, tenants } from '../db/schema'

/**
 * 운영 현황(공개 집계) 서비스 — 크로스 테넌트 합계만 계산한다(테넌트 이름·키는 절대 다루지 않음).
 *
 * - 가입(REAL): tenants 행 집계. 총 가입 = count(*), 오늘 가입 = created_at >= 오늘 0시.
 * - 방문/트래픽(TRACKED): 방문 핑으로 채워지는 site_visit_days/site_visitors 집계.
 *
 * 일(day) 경계는 서버 로컬 자정 기준이다(DB now()/current_date 와 동일 의미). 핑이 만드는
 * 일 버킷도 동일 함수로 계산하므로 '오늘 가입'과 '오늘 방문자'의 하루 정의가 일치한다.
 */
@Injectable()
export class StatsService {
  constructor(
    private readonly dbs: DatabaseService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  /** 오늘 0시(서버 로컬)부터의 Date — '오늘 가입' 경계. DB now() 와 같은 벽시계 기준. */
  private startOfToday(now = new Date()): Date {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }

  /** 서버 로컬 기준 오늘 날짜(YYYY-MM-DD) — date 컬럼 버킷 키. */
  private todayKey(now = new Date()): string {
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  /**
   * 운영 현황 집계 — 공개 노출용(인증 없음). 카운터(숫자)만 반환한다.
   * 방문 테이블이 비어 있으면 0 으로 정직하게 내려간다(가짜 시드 금지).
   */
  async overview(): Promise<StatsOverviewDto> {
    const today = this.startOfToday()

    const [signupRows, todaySignupRows, trafficRows, todayVisitorRows] = await Promise.all([
      this.dbs.db.select({ c: sql<number>`count(*)::int` }).from(tenants),
      this.dbs.db
        .select({ c: sql<number>`count(*)::int` })
        .from(tenants)
        .where(gte(tenants.createdAt, today)),
      this.dbs.db
        .select({ c: sql<number>`coalesce(sum(${siteVisitDays.pageviews}), 0)::int` })
        .from(siteVisitDays),
      this.dbs.db
        .select({ c: siteVisitDays.visitors })
        .from(siteVisitDays)
        .where(eq(siteVisitDays.day, this.todayKey()))
        .limit(1),
    ])

    return {
      totalSignups: Number(signupRows[0]?.c ?? 0),
      todaySignups: Number(todaySignupRows[0]?.c ?? 0),
      totalTraffic: Number(trafficRows[0]?.c ?? 0),
      todayVisitors: Number(todayVisitorRows[0]?.c ?? 0),
    }
  }

  /**
   * 방문 핑 기록 — 항상 페이지뷰 +1, (오늘, 방문자해시)가 처음이면 고유 방문자 +1.
   * (day, visitor_hash) INSERT ... ON CONFLICT DO NOTHING 로 멱등 중복 제거.
   * 일 버킷은 서버가 now() 로 계산한다(클라이언트 숫자는 절대 신뢰하지 않음).
   */
  async recordVisit(clientId: string): Promise<void> {
    const day = this.todayKey()
    const hash = visitorHash(clientId, this.cfg.keyPepper)

    // 하루 버킷 행을 보장(없으면 0 으로 생성).
    await this.dbs.db
      .insert(siteVisitDays)
      .values({ day, visitors: 0, pageviews: 0 })
      .onConflictDoNothing({ target: siteVisitDays.day })

    // 신규 고유 방문자 여부 — 삽입 성공한 행 수로 판정.
    const inserted = await this.dbs.db
      .insert(siteVisitors)
      .values({ day, visitorHash: hash })
      .onConflictDoNothing({ target: [siteVisitors.day, siteVisitors.visitorHash] })
      .returning({ day: siteVisitors.day })
    const isNewVisitor = inserted.length > 0

    await this.dbs.db
      .update(siteVisitDays)
      .set({
        pageviews: sql`${siteVisitDays.pageviews} + 1`,
        visitors: isNewVisitor ? sql`${siteVisitDays.visitors} + 1` : siteVisitDays.visitors,
      })
      .where(eq(siteVisitDays.day, day))
  }
}
