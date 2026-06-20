import { PGlite } from '@electric-sql/pglite'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { hashSecret, lookupHash } from '../common/secret'
import { loadConfig, type AppConfig } from '../config'
import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { tenants } from '../db/schema'

import { StatsService } from './stats.service'

import type { Database, DatabaseService } from '../db/database.service'

const PEPPER = 'it-pepper'

async function makeStack(): Promise<{ dbs: DatabaseService; stats: StatsService }> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  const cfg: AppConfig = { ...loadConfig(), keyPepper: PEPPER }
  return { dbs, stats: new StatsService(dbs, cfg) }
}

/** 테넌트 1행 시드 — createdAt 을 명시하면 '오늘/과거' 경계 검증에 쓴다. */
async function seedTenant(dbs: DatabaseService, createdAt?: Date): Promise<void> {
  const suffix = Math.random().toString(36).slice(2, 8)
  await dbs.db.insert(tenants).values({
    name: 'Acme',
    slug: `acme-${suffix}`,
    plan: 'free',
    publishableKey: `pk_${suffix}`,
    secretKeyHash: hashSecret(`sk_${suffix}`, PEPPER),
    secretKeyLookup: lookupHash(`sk_${suffix}`, PEPPER),
    corsOrigins: ['*'],
    usageCount: 0,
    ...(createdAt ? { createdAt } : {}),
  })
}

describe('StatsService 운영 현황 집계 (PGlite)', () => {
  let dbs: DatabaseService
  let stats: StatsService

  beforeEach(async () => {
    ;({ dbs, stats } = await makeStack())
  })

  it('가입 집계 — 총/오늘 경계를 정확히 구분한다 (REAL)', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(12, 0, 0, 0)

    await seedTenant(dbs, yesterday) // 어제 가입 → total 만 +1
    await seedTenant(dbs) // 오늘 가입(now) → total·today 둘 다 +1
    await seedTenant(dbs)

    const out = await stats.overview()
    expect(out.totalSignups).toBe(3)
    expect(out.todaySignups).toBe(2)
  })

  it('빈 상태는 0 으로 정직하게 내려간다 (가짜 시드 없음)', async () => {
    const out = await stats.overview()
    expect(out).toEqual({
      totalSignups: 0,
      todaySignups: 0,
      totalTraffic: 0,
      todayVisitors: 0,
    })
  })

  it('방문 핑 — 페이지뷰는 매번 증가, 고유 방문자는 (일,해시) 중복 제거된다', async () => {
    // 같은 브라우저(client-A)가 두 번 핑 → 방문자 1, 트래픽 2.
    await stats.recordVisit('client-A')
    await stats.recordVisit('client-A')
    let out = await stats.overview()
    expect(out.todayVisitors).toBe(1)
    expect(out.totalTraffic).toBe(2)

    // 다른 브라우저(client-B) 핑 → 방문자 2, 트래픽 3.
    await stats.recordVisit('client-B')
    out = await stats.overview()
    expect(out.todayVisitors).toBe(2)
    expect(out.totalTraffic).toBe(3)
  })

  it('총 트래픽은 과거 일자 페이지뷰까지 합산하고, 오늘 방문자는 오늘만 센다', async () => {
    // 어제 버킷을 직접 채워 둔다(고유 방문자 2, 페이지뷰 5).
    const y = new Date()
    y.setDate(y.getDate() - 1)
    const ymd = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(
      y.getDate()
    ).padStart(2, '0')}`
    await dbs.db.execute(
      sql`INSERT INTO site_visit_days (day, visitors, pageviews) VALUES (${ymd}, 2, 5)`
    )

    // 오늘 핑 1회(신규 방문자 1, 페이지뷰 1).
    await stats.recordVisit('client-today')

    const out = await stats.overview()
    expect(out.totalTraffic).toBe(6) // 5(어제) + 1(오늘)
    expect(out.todayVisitors).toBe(1) // 오늘 버킷만
  })

  it('방문자 해시는 clientId 를 평문 저장하지 않는다 (프라이버시)', async () => {
    await stats.recordVisit('client-secret-123')
    const rows = (await dbs.db.execute(sql`SELECT visitor_hash FROM site_visitors`)) as unknown as {
      rows?: { visitor_hash: string }[]
    }
    const list = rows.rows ?? (rows as unknown as { visitor_hash: string }[])
    const hashes = (Array.isArray(list) ? list : []).map((r) => r.visitor_hash)
    expect(hashes).toHaveLength(1)
    expect(hashes[0]).not.toContain('client-secret-123')
    expect(hashes[0]).toMatch(/^[a-f0-9]{64}$/)
  })
})
