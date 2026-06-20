import {
  PLAN_USER_LIMITS,
  UNLIMITED,
  generatePublishableKey,
  generateSecretKey,
  hashSecretKey,
} from '@authdesk/shared'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { loadConfig, type AppConfig } from '../config'
import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { endUsers, tenants } from '../db/schema'
import { TenantsService } from '../tenants/tenants.service'

import { AuthService } from './auth.service'
import { TokenService } from './token.service'

import type { Database, DatabaseService } from '../db/database.service'
import type { TenantRecord } from '../tenants/tenant.types'

const PEPPER = 'it-pepper'

interface Stack {
  dbs: DatabaseService
  auth: AuthService
  tokens: TokenService
  tenants: TenantsService
  cfg: AppConfig
}

async function makeStack(): Promise<Stack> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  const cfg: AppConfig = {
    ...loadConfig(),
    keyPepper: PEPPER,
    jwtSecret: 'it-jwt',
    accessTtlSeconds: 3600,
  }
  const tokens = new TokenService(cfg)
  const tenantsSvc = new TenantsService(dbs, cfg)
  const auth = new AuthService(dbs, tokens, tenantsSvc)
  return { dbs, auth, tokens, tenants: tenantsSvc, cfg }
}

/** 알려진 pk/sk 로 데모 테넌트를 심고 TenantRecord 를 돌려준다. */
async function seedTenant(
  dbs: DatabaseService,
  plan: 'free' | 'pro' = 'free'
): Promise<TenantRecord> {
  const publishableKey = generatePublishableKey()
  const secretKey = generateSecretKey()
  const rows = await dbs.db
    .insert(tenants)
    .values({
      name: 'Acme',
      slug: `acme-${Math.random().toString(36).slice(2, 8)}`,
      plan,
      publishableKey,
      secretKeyHash: hashSecretKey(secretKey, PEPPER),
      corsOrigins: ['https://app.test'],
    })
    .returning()
  const row = rows[0]!
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    publishableKey: row.publishableKey,
    secretKeyHash: row.secretKeyHash,
    corsOrigins: row.corsOrigins,
    plan: row.plan,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

const REG = { email: 'User@Acme.test', password: 'Hunter2!pw', name: 'Test User' }

describe('AuthService (PGlite, end-user 인증)', () => {
  let dbs: DatabaseService
  let auth: AuthService

  beforeEach(async () => {
    ;({ dbs, auth } = await makeStack())
  })

  it('가입 → 사용자 DTO + 토큰 반환, 이메일은 정규화, passwordHash 미노출', async () => {
    const tenant = await seedTenant(dbs)
    const result = await auth.register(tenant, REG)
    expect(result.user.email).toBe('user@acme.test') // 소문자 정규화
    expect(result.user.name).toBe('Test User')
    expect(result.user.verified).toBe(false)
    expect(result.token.split('.')).toHaveLength(3) // JWT
    expect(result.expiresIn).toBe(3600)
    expect(result.user).not.toHaveProperty('passwordHash')
  })

  it('같은 테넌트에 중복 이메일은 409', async () => {
    const tenant = await seedTenant(dbs)
    await auth.register(tenant, REG)
    await expect(auth.register(tenant, REG)).rejects.toMatchObject({ status: 409 })
  })

  it('다른 테넌트는 같은 이메일을 독립적으로 가질 수 있다(풀 격리)', async () => {
    const a = await seedTenant(dbs)
    const b = await seedTenant(dbs)
    await auth.register(a, REG)
    await expect(auth.register(b, REG)).resolves.toBeTruthy()
  })

  it('로그인 — 올바른 비밀번호만 통과(scrypt 검증)', async () => {
    const tenant = await seedTenant(dbs)
    await auth.register(tenant, REG)
    const ok = await auth.login(tenant, { email: 'user@acme.test', password: 'Hunter2!pw' })
    expect(ok.token.split('.')).toHaveLength(3)
    await expect(
      auth.login(tenant, { email: 'user@acme.test', password: 'wrong-pass' })
    ).rejects.toMatchObject({ status: 401 })
    // 존재하지 않는 사용자도 동일하게 401
    await expect(
      auth.login(tenant, { email: 'nobody@acme.test', password: 'whatever1' })
    ).rejects.toMatchObject({ status: 401 })
  })

  it('me — 발급 토큰의 세션을 인증해 사용자를 반환', async () => {
    const tenant = await seedTenant(dbs)
    const { token } = await auth.register(tenant, REG)
    const ctx = await auth.authenticate(token)
    expect(ctx).not.toBeNull()
    const me = await auth.me(ctx!)
    expect(me.email).toBe('user@acme.test')
  })

  it('logout — 세션을 폐기하면 토큰 인증이 실패한다', async () => {
    const tenant = await seedTenant(dbs)
    const { token } = await auth.register(tenant, REG)
    const ctx = await auth.authenticate(token)
    expect(ctx).not.toBeNull()
    await auth.logout(ctx!)
    expect(await auth.authenticate(token)).toBeNull()
  })

  it('listUsers — 페이지네이션 + 이메일 부분검색, 테넌트 격리', async () => {
    const tenant = await seedTenant(dbs)
    const other = await seedTenant(dbs)
    await auth.register(tenant, { email: 'ada@acme.test', password: 'Hunter2!pw', name: 'Ada' })
    await auth.register(tenant, { email: 'alan@acme.test', password: 'Hunter2!pw', name: 'Alan' })
    await auth.register(other, { email: 'zzz@other.test', password: 'Hunter2!pw', name: 'Z' })

    const all = await auth.listUsers(tenant.id, { offset: 0, limit: 25 })
    expect(all.total).toBe(2)
    expect(all.items).toHaveLength(2)

    const filtered = await auth.listUsers(tenant.id, { offset: 0, limit: 25, q: 'ada' })
    expect(filtered.total).toBe(1)
    expect(filtered.items[0]!.email).toBe('ada@acme.test')
  })

  it('deleteUser — 사용자/세션 삭제, 토큰 인증 실패, 타 테넌트는 404', async () => {
    const tenant = await seedTenant(dbs)
    const other = await seedTenant(dbs)
    const { token, user } = await auth.register(tenant, REG)
    // 다른 테넌트는 이 사용자를 못 지운다
    await expect(auth.deleteUser(other.id, user.id)).rejects.toMatchObject({ status: 404 })
    await auth.deleteUser(tenant.id, user.id)
    expect(await auth.authenticate(token)).toBeNull()
    const list = await auth.listUsers(tenant.id, { offset: 0, limit: 25 })
    expect(list.total).toBe(0)
  })

  it('stats — 사용자 수·로그인·verified 를 집계', async () => {
    const tenant = await seedTenant(dbs, 'pro')
    await auth.register(tenant, { email: 'a@acme.test', password: 'Hunter2!pw', name: 'A' })
    await auth.register(tenant, { email: 'b@acme.test', password: 'Hunter2!pw', name: 'B' })
    await auth.login(tenant, { email: 'a@acme.test', password: 'Hunter2!pw' })

    const stats = await auth.stats(tenant.id, tenant.plan)
    expect(stats.userCount).toBe(2)
    expect(stats.signups.last7d).toBe(2)
    expect(stats.signups.last30d).toBe(2)
    expect(stats.logins).toBe(1)
    expect(stats.verified).toBe(0)
    expect(stats.plan).toBe('pro')
  })

  it('stats — todaySignups 는 오늘 가입만, 어제 가입은 제외(자정 경계)', async () => {
    const tenant = await seedTenant(dbs)
    // 오늘 가입 1명(실시간 register)
    await auth.register(tenant, { email: 'today@acme.test', password: 'Hunter2!pw', name: 'T' })
    // 어제(자정 직전) 가입 1명을 직접 심는다 — 오늘 카운트에서 빠져야 한다.
    const yesterday = new Date()
    yesterday.setHours(0, 0, 0, 0)
    yesterday.setMilliseconds(-1)
    await dbs.db.insert(endUsers).values({
      tenantId: tenant.id,
      email: 'yesterday@acme.test',
      passwordHash: 'scrypt$32768$00$00',
      name: 'Y',
      createdAt: yesterday,
    })

    const stats = await auth.stats(tenant.id, tenant.plan)
    expect(stats.userCount).toBe(2)
    expect(stats.todaySignups).toBe(1) // 오늘 가입만
  })

  it('stats — 트래픽 기본은 0/null, 추적 데이터가 없으면 since=null', async () => {
    const tenant = await seedTenant(dbs)
    const stats = await auth.stats(tenant.id, tenant.plan)
    expect(stats.traffic).toEqual({ today: 0, total: 0, todayVisitors: 0, since: null })
  })

  it('trackVisit — visits 누적, 같은 vid 는 같은 날 1회만 unique', async () => {
    const tenant = await seedTenant(dbs)

    const first = await auth.trackVisit(tenant, 'vid-1', '1.1.1.1')
    expect(first).toEqual({ ok: true, unique: true })
    // 같은 vid 재방문 — visits 는 늘지만 unique 는 아니다
    const again = await auth.trackVisit(tenant, 'vid-1', '1.1.1.1')
    expect(again.unique).toBe(false)
    // 다른 vid — 새 고유 방문자
    const second = await auth.trackVisit(tenant, 'vid-2', '2.2.2.2')
    expect(second.unique).toBe(true)

    const stats = await auth.stats(tenant.id, tenant.plan)
    expect(stats.traffic.today).toBe(3) // 총 방문 3
    expect(stats.traffic.total).toBe(3)
    expect(stats.traffic.todayVisitors).toBe(2) // 고유 방문자 2
    expect(stats.traffic.since).not.toBeNull()
  })

  it('trackVisit — vid 가 없으면 IP 로 고유 방문자를 근사한다', async () => {
    const tenant = await seedTenant(dbs)
    const a = await auth.trackVisit(tenant, undefined, '9.9.9.9')
    expect(a.unique).toBe(true)
    const b = await auth.trackVisit(tenant, undefined, '9.9.9.9') // 같은 IP → 중복
    expect(b.unique).toBe(false)
    const c = await auth.trackVisit(tenant, undefined, '8.8.8.8') // 다른 IP → 신규
    expect(c.unique).toBe(true)

    const stats = await auth.stats(tenant.id, tenant.plan)
    expect(stats.traffic.todayVisitors).toBe(2)
  })

  it('trackVisit — 테넌트 범위 격리(다른 테넌트의 트래픽은 섞이지 않는다)', async () => {
    const a = await seedTenant(dbs)
    const b = await seedTenant(dbs)
    await auth.trackVisit(a, 'vid-x', '1.1.1.1')
    await auth.trackVisit(a, 'vid-y', '1.1.1.2')
    await auth.trackVisit(b, 'vid-x', '1.1.1.1')

    const statsA = await auth.stats(a.id, a.plan)
    const statsB = await auth.stats(b.id, b.plan)
    expect(statsA.traffic.total).toBe(2)
    expect(statsB.traffic.total).toBe(1)
  })

  /** 비밀번호 해시 없이(scrypt 회피) 더미 end-user 를 직접 채워 풀 크기를 만든다. */
  async function fillUsers(tenantId: string, n: number): Promise<void> {
    const rows = Array.from({ length: n }, (_, i) => ({
      tenantId,
      email: `dummy-${i}@acme.test`,
      passwordHash: 'scrypt$32768$00$00',
      name: `Dummy ${i}`,
    }))
    await dbs.db.insert(endUsers).values(rows)
  }

  it('가입 — 플랜 한도에 도달하면 403 으로 거절(라이브 count 기준)', async () => {
    const tenant = await seedTenant(dbs) // free: 1000
    await fillUsers(tenant.id, PLAN_USER_LIMITS.free)

    await expect(auth.register(tenant, REG)).rejects.toMatchObject({ status: 403 })
    // 한도 미만으로 떨어지면 다시 가입 가능
    await auth.deleteUser(
      tenant.id,
      (await auth.listUsers(tenant.id, { offset: 0, limit: 1 })).items[0]!.id
    )
    await expect(auth.register(tenant, REG)).resolves.toBeTruthy()
  })

  it('가입 — 한도 미만이면 정상 가입(한도 직전 경계)', async () => {
    const tenant = await seedTenant(dbs)
    await fillUsers(tenant.id, PLAN_USER_LIMITS.free - 1)
    await expect(auth.register(tenant, REG)).resolves.toBeTruthy()
  })

  it('usage — auth_users 는 라이브 count·플랜 한도, logins 는 누적·무제한', async () => {
    const tenant = await seedTenant(dbs, 'pro')
    await auth.register(tenant, { email: 'a@acme.test', password: 'Hunter2!pw', name: 'A' })
    await auth.register(tenant, { email: 'b@acme.test', password: 'Hunter2!pw', name: 'B' })
    await auth.login(tenant, { email: 'a@acme.test', password: 'Hunter2!pw' })

    const usage = await auth.usage(tenant.id, tenant.plan)
    expect(usage.tenantId).toBe(tenant.id)
    expect(usage.plan).toBe('pro')

    const authUsers = usage.metrics.find((m) => m.metric === 'auth_users')
    expect(authUsers).toEqual({
      metric: 'auth_users',
      used: 2,
      limit: PLAN_USER_LIMITS.pro,
      remaining: PLAN_USER_LIMITS.pro - 2,
    })

    const logins = usage.metrics.find((m) => m.metric === 'logins')
    expect(logins).toEqual({ metric: 'logins', used: 1, limit: UNLIMITED, remaining: UNLIMITED })
  })
})
