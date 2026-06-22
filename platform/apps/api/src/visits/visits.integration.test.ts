import { visitPingSchema } from '@desk/shared'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { DrizzleVisitsStore } from '../stores/drizzle-visits.store'

import { VisitsService } from './visits.service'

import type { Database, DatabaseService } from '../db/database.service'

/** PGlite 인메모리 + 마이그레이션 → DrizzleVisitsStore + VisitsService 스택. */
async function makeService(): Promise<VisitsService> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  return new VisitsService(new DrizzleVisitsStore(dbs))
}

describe('visitPingSchema (Zod)', () => {
  it('빈 본문은 기본값 {}', () => {
    expect(visitPingSchema.parse(undefined)).toEqual({})
    expect(visitPingSchema.parse({})).toEqual({})
  })

  it('newVisitor 불리언만 허용', () => {
    expect(visitPingSchema.parse({ newVisitor: true })).toEqual({ newVisitor: true })
    expect(visitPingSchema.safeParse({ newVisitor: 'yes' }).success).toBe(false)
  })
})

describe('VisitsService (PGlite, Drizzle store)', () => {
  const appId = 'sample-service'

  let service: VisitsService

  beforeEach(async () => {
    service = await makeService()
  })

  it('빈 백엔드 — 시드 없이 0(가짜 데모 숫자 금지)', async () => {
    const stats = await service.stats(appId)
    expect(stats.appId).toBe(appId)
    expect(stats.todayVisits).toBe(0)
    expect(stats.todayUniques).toBe(0)
    expect(stats.totalVisits).toBe(0)
    expect(stats.totalUniques).toBe(0)
  })

  it('ping — 방문 +1, newVisitor 면 고유 방문자도 +1', async () => {
    await service.ping(appId, { newVisitor: true })
    await service.ping(appId, {})
    await service.ping(appId, { newVisitor: true })

    const stats = await service.stats(appId)
    expect(stats.todayVisits).toBe(3)
    expect(stats.todayUniques).toBe(2)
    expect(stats.totalVisits).toBe(3)
    expect(stats.totalUniques).toBe(2)
  })

  it('빈 본문(undefined) 핑 — 방문만 +1, 고유는 그대로', async () => {
    await service.ping(appId, visitPingSchema.parse(undefined))
    const stats = await service.stats(appId)
    expect(stats.todayVisits).toBe(1)
    expect(stats.todayUniques).toBe(0)
  })

  it('appId 격리 — 다른 앱 집계는 서로 영향 없음', async () => {
    await service.ping(appId, { newVisitor: true })
    await service.ping('rotifolk', {})

    const a = await service.stats(appId)
    expect(a.totalVisits).toBe(1)
    expect(a.totalUniques).toBe(1)

    const r = await service.stats('rotifolk')
    expect(r.totalVisits).toBe(1)
    expect(r.totalUniques).toBe(0)
  })

  it('appId 정규화·검증 — 대문자 소문자화, 잘못된 형식 거부', async () => {
    await service.ping('SampleService', { newVisitor: true })
    const stats = await service.stats('sampleservice')
    expect(stats.totalVisits).toBe(1)

    await expect(service.ping('bad app!', {})).rejects.toThrow()
    await expect(service.stats('bad app!')).rejects.toThrow()
  })

  it('전체 누적은 모든 일자 버킷 합 — 과거 일자 행도 totalVisits 에 포함', async () => {
    // 같은 appId 의 과거 일자 행을 직접 삽입(서비스는 항상 오늘만 기록).
    const client = await PGlite.create()
    const db = drizzle(client, { schema }) as unknown as Database
    for (const m of MIGRATIONS) await client.exec(m.sql)
    const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
    await db.insert(schema.dailyVisits).values({ appId, day: '2020-01-01', visits: 5, uniques: 3 })
    const svc = new VisitsService(new DrizzleVisitsStore(dbs))
    await svc.ping(appId, { newVisitor: true })

    const stats = await svc.stats(appId)
    // 오늘은 방금 핑 1건만, 전체는 과거 5 + 오늘 1 = 6.
    expect(stats.todayVisits).toBe(1)
    expect(stats.todayUniques).toBe(1)
    expect(stats.totalVisits).toBe(6)
    expect(stats.totalUniques).toBe(4)
  })
})
