import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { MIGRATIONS } from '../db/migrations'
import { moderationLogs, reports } from '../db/schema'
import * as schema from '../db/schema'
import { TenantsService, type TenantRow } from '../tenants/tenants.service'

import { StatsService } from './stats.service'

import type { Database, DatabaseService } from '../db/database.service'
import type { Verdict } from '@moderationdesk/shared'

async function setup(): Promise<{
  db: Database
  tenants: TenantsService
  stats: StatsService
}> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  return { db, tenants: new TenantsService(dbs), stats: new StatsService(dbs) }
}

async function makeTenant(tenants: TenantsService, name = 'T'): Promise<TenantRow> {
  const res = await tenants.createTenant({ name, corsOrigins: ['*'] })
  return (await tenants.findById(res.tenant.id))!
}

const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

async function insertLog(
  db: Database,
  tenantId: string,
  opts: { verdict?: Verdict; source?: string | null; daysAgo: number }
): Promise<void> {
  await db.insert(moderationLogs).values({
    tenantId,
    text: 'x',
    verdict: opts.verdict ?? 'allow',
    matchedRules: [],
    aiScore: null,
    source: opts.source ?? 'web',
    createdAt: daysAgo(opts.daysAgo),
  })
}

describe('StatsService (PGlite)', () => {
  let db: Database
  let tenants: TenantsService
  let stats: StatsService

  beforeEach(async () => {
    ;({ db, tenants, stats } = await setup())
  })

  it('트래픽: total 은 전체 로그 수, today 는 오늘(자정 이후)만', async () => {
    const t = await makeTenant(tenants)
    // 오늘 2건, 과거 3건.
    await insertLog(db, t.id, { daysAgo: 0 })
    await insertLog(db, t.id, { daysAgo: 0 })
    await insertLog(db, t.id, { daysAgo: 1 })
    await insertLog(db, t.id, { daysAgo: 2 })
    await insertLog(db, t.id, { daysAgo: 10 })

    const s = await stats.getStats(t, 'tenant')
    expect(s.traffic.total).toBe(5)
    expect(s.traffic.today).toBe(2)
  })

  it('트래픽은 테넌트 격리 — 타 테넌트 로그는 안 셈', async () => {
    const a = await makeTenant(tenants, 'A')
    const b = await makeTenant(tenants, 'B')
    await insertLog(db, a.id, { daysAgo: 0 })
    await insertLog(db, b.id, { daysAgo: 0 })
    await insertLog(db, b.id, { daysAgo: 1 })

    expect((await stats.getStats(a, 'tenant')).traffic.total).toBe(1)
    expect((await stats.getStats(b, 'tenant')).traffic.total).toBe(2)
  })

  it('방문자(오늘): 오늘의 distinct source 근사치(estimated)', async () => {
    const t = await makeTenant(tenants)
    // 오늘: web×2 + api×1 → distinct 2. 어제 mobile 은 제외.
    await insertLog(db, t.id, { source: 'web', daysAgo: 0 })
    await insertLog(db, t.id, { source: 'web', daysAgo: 0 })
    await insertLog(db, t.id, { source: 'api', daysAgo: 0 })
    await insertLog(db, t.id, { source: 'mobile', daysAgo: 1 })

    const s = await stats.getStats(t, 'tenant')
    expect(s.visitors.today).toBe(2)
    expect(s.visitors.estimated).toBe(true)
    expect(s.visitors.source).toContain('distinct')
  })

  it('방문자(오늘): 신고자(reporterId)도 distinct 합집합에 포함', async () => {
    const t = await makeTenant(tenants)
    await insertLog(db, t.id, { source: 'web', daysAgo: 0 }) // actor 'web'
    // 오늘 신고 2건: 서로 다른 reporter 2명 → +2.
    await db.insert(reports).values([
      {
        tenantId: t.id,
        subjectType: 'comment',
        subjectId: 'c1',
        reason: 'r',
        reporterId: 'user_1',
        status: 'open',
        createdAt: daysAgo(0),
      },
      {
        tenantId: t.id,
        subjectType: 'comment',
        subjectId: 'c2',
        reason: 'r',
        reporterId: 'user_2',
        status: 'open',
        createdAt: daysAgo(0),
      },
    ])
    const s = await stats.getStats(t, 'tenant')
    expect(s.visitors.today).toBe(3) // 'web' + user_1 + user_2
  })

  it('가입(operator): tenants 전체 — total=count, today=오늘 생성', async () => {
    const a = await makeTenant(tenants, 'A')
    await makeTenant(tenants, 'B')
    await makeTenant(tenants, 'C')

    const s = await stats.getStats(a, 'operator')
    expect(s.signups.total).toBe(3)
    expect(s.signups.today).toBe(3) // 방금 만든 테넌트는 오늘 생성
    expect(s.signups.operatorOnly).toBe(false)
  })

  it('가입(tenant): 본인 기준 — total=1, operatorOnly=true', async () => {
    const a = await makeTenant(tenants, 'A')
    await makeTenant(tenants, 'B') // 다른 테넌트가 있어도

    const s = await stats.getStats(a, 'tenant')
    expect(s.signups.total).toBe(1)
    expect(s.signups.today).toBe(1) // 본인은 오늘 가입
    expect(s.signups.operatorOnly).toBe(true)
  })

  it('scope 값이 응답에 그대로 실린다', async () => {
    const t = await makeTenant(tenants)
    expect((await stats.getStats(t, 'tenant')).scope).toBe('tenant')
    expect((await stats.getStats(t, 'operator')).scope).toBe('operator')
  })

  it('빈 테넌트는 0(트래픽/방문자) — 운영자 가입만 1+', async () => {
    const t = await makeTenant(tenants)
    const s = await stats.getStats(t, 'tenant')
    expect(s.traffic.total).toBe(0)
    expect(s.traffic.today).toBe(0)
    expect(s.visitors.today).toBe(0)
  })
})
