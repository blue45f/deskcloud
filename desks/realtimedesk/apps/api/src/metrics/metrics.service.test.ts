import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'

import { MetricsService } from './metrics.service'

import type { Database, DatabaseService } from '../db/database.service'

async function makeService(): Promise<{
  dbs: DatabaseService
  svc: MetricsService
}> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  return { dbs, svc: new MetricsService(dbs) }
}

/** 테스트용 테넌트 직접 삽입(생성 시각 지정 가능). */
async function seedTenant(dbs: DatabaseService, createdAt: Date): Promise<void> {
  await dbs.db.insert(schema.tenants).values({
    name: 't',
    publishableKey: `pk_${Math.random().toString(16).slice(2, 12)}`,
    secretKeyHash: Math.random().toString(16).slice(2),
    corsOrigins: ['*'],
    createdAt,
  })
}

describe('MetricsService (PGlite)', () => {
  let dbs: DatabaseService
  let svc: MetricsService

  beforeEach(async () => {
    ;({ dbs, svc } = await makeService())
  })

  describe('KST 일자 경계', () => {
    it('kstDayKey 는 UTC 늦은밤을 다음날(KST)로 매핑한다', () => {
      // 2026-06-19 16:00Z = 2026-06-20 01:00 KST → '2026-06-20'
      expect(MetricsService.kstDayKey(new Date('2026-06-19T16:00:00Z'))).toBe('2026-06-20')
      // 2026-06-19 14:00Z = 2026-06-19 23:00 KST → '2026-06-19'
      expect(MetricsService.kstDayKey(new Date('2026-06-19T14:00:00Z'))).toBe('2026-06-19')
    })

    it('kstTodayStartUtc 는 KST 자정의 UTC 순간(전날 15:00Z)이다', () => {
      const start = MetricsService.kstTodayStartUtc(new Date('2026-06-20T05:00:00Z'))
      expect(start.toISOString()).toBe('2026-06-19T15:00:00.000Z')
    })
  })

  describe('recordVisit — 멱등 누적', () => {
    it('hit 는 항상 +1, firstToday 면 visitor 도 +1', async () => {
      await svc.recordVisit({ firstToday: true })
      await svc.recordVisit({}) // hit 만
      await svc.recordVisit({ firstToday: false }) // hit 만

      const stats = await svc.stats()
      expect(stats.traffic.todayHits).toBe(3)
      expect(stats.traffic.todayVisitors).toBe(1)
      expect(stats.traffic.totalHits).toBe(3)
      expect(stats.traffic.totalVisitors).toBe(1)
    })

    it('같은 day 행에 INSERT/UPDATE 로 누적된다(ON CONFLICT)', async () => {
      const day = MetricsService.kstDayKey()
      for (let i = 0; i < 5; i += 1) await svc.recordVisit({ firstToday: true })

      const rows = await dbs.db.select().from(schema.visits)
      expect(rows).toHaveLength(1) // 하루 1 행만
      expect(rows[0]!.day).toBe(day)
      expect(rows[0]!.hits).toBe(5)
      expect(rows[0]!.visitors).toBe(5)
    })
  })

  describe('stats — 가입(real) 집계', () => {
    it('total 은 전체, today 는 KST 자정 이후 가입만 센다', async () => {
      const now = new Date('2026-06-20T05:00:00Z') // KST 14:00, 오늘=2026-06-20
      // 오늘(KST) 가입 2건 — KST 자정(전날 15:00Z) 이후.
      await seedTenant(dbs, new Date('2026-06-19T15:30:00Z'))
      await seedTenant(dbs, new Date('2026-06-20T04:00:00Z'))
      // 어제(KST) 가입 1건 — KST 자정 직전.
      await seedTenant(dbs, new Date('2026-06-19T14:00:00Z'))

      const stats = await svc.stats(now)
      expect(stats.signups.total).toBe(3)
      expect(stats.signups.today).toBe(2)
    })

    it('가입·방문이 없으면 0(빈 데모를 가짜 숫자로 채우지 않음)', async () => {
      const stats = await svc.stats()
      expect(stats.signups.total).toBe(0)
      expect(stats.signups.today).toBe(0)
      expect(stats.traffic.totalHits).toBe(0)
      expect(stats.traffic.totalVisitors).toBe(0)
    })
  })
})
