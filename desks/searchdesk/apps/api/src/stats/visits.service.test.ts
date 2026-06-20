import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { TenantsService } from '../tenants/tenants.service'

import { VisitsService } from './visits.service'

import type { Database, DatabaseService } from '../db/database.service'

interface Harness {
  dbs: DatabaseService
  tenants: TenantsService
  visits: VisitsService
}

async function makeHarness(): Promise<Harness> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) {
    // PGlite 폴백 경로 — postgres 전용 마이그레이션은 건너뜀.
    if (m.only && !m.only.includes('pglite')) continue
    await client.exec(m.sql)
  }
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  return { dbs, tenants: new TenantsService(dbs), visits: new VisitsService(dbs) }
}

describe('VisitsService.getPlatformStats / recordVisit', () => {
  let h: Harness

  beforeEach(async () => {
    h = await makeHarness()
  })

  it('비어 있으면 모든 지표가 0(시드/조작 없음)', async () => {
    const s = await h.visits.getPlatformStats()
    expect(s.totalTraffic).toBe(0)
    expect(s.todayVisitors).toBe(0)
    expect(s.totalSignups).toBe(0)
    expect(s.todaySignups).toBe(0)
    expect(typeof s.asOf).toBe('string')
  })

  it('recordVisit 가 오늘 버킷에 멱등 누적(UPSERT) — 트래픽 +1, 신규만 고유 +1', async () => {
    await h.visits.recordVisit({ visitorIsNew: true }) // 신규 방문자
    await h.visits.recordVisit({ visitorIsNew: false }) // 재방문(같은 쿠키)
    await h.visits.recordVisit({ visitorIsNew: true }) // 또 다른 신규 방문자

    const s = await h.visits.getPlatformStats()
    expect(s.totalTraffic).toBe(3) // 누적 페이지뷰 3
    expect(s.todayVisitors).toBe(2) // 고유 방문자 2(신규 2)
  })

  it('가입 지표는 tenants 실측 — signup 으로 총/오늘 가입 증가', async () => {
    await h.tenants.signup({ name: 'Alpha' })
    await h.tenants.signup({ name: 'Beta' })

    const s = await h.visits.getPlatformStats()
    expect(s.totalSignups).toBe(2)
    expect(s.todaySignups).toBe(2) // 방금 만든 행은 오늘 경계 이후
  })
})
