import { TenantService, UsageMeter } from '@desk/core'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { DrizzleTenantStore } from '../stores/drizzle-tenant.store'
import { DrizzleUsageStore } from '../stores/drizzle-usage.store'

import type { Database, DatabaseService } from '../db/database.service'

/** PGlite 인메모리 DB + 부팅 마이그레이션을 적용한 가짜 DatabaseService. */
async function makeStack(): Promise<{
  tenants: TenantService
  usage: UsageMeter
  dbs: DatabaseService
}> {
  const client = await PGlite.create() // 인메모리(경로 미지정)
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  return {
    tenants: new TenantService(new DrizzleTenantStore(dbs), 'it-pepper'),
    usage: new UsageMeter(new DrizzleUsageStore(dbs)),
    dbs,
  }
}

describe('Tenants + Usage (PGlite, Drizzle stores)', () => {
  let tenants: TenantService
  let usage: UsageMeter

  beforeEach(async () => {
    ;({ tenants, usage } = await makeStack())
  })

  it('가입: Drizzle 영속화 + secret 평문 1회 반환', async () => {
    const t = await tenants.signup({ name: 'Acme Inc.' })
    expect(t.slug).toBe('acme-inc')
    expect(t.plan).toBe('free')
    expect(t.publishableKey.startsWith('pk_')).toBe(true)
    expect(t.secretKey.startsWith('sk_')).toBe(true)
  })

  it('가입 → secret 키 인증으로 같은 테넌트 해석', async () => {
    const t = await tenants.signup({ name: 'Acme' })
    const auth = await tenants.authenticateBySecretKey(t.secretKey)
    expect(auth?.id).toBe(t.id)
    expect(auth?.name).toBe('Acme')
  })

  it('slug 충돌 회피(유니크 제약과 함께)', async () => {
    const a = await tenants.signup({ name: 'Dup', slug: 'dup' })
    const b = await tenants.signup({ name: 'Dup2', slug: 'dup' })
    expect(a.slug).toBe('dup')
    expect(b.slug).toBe('dup-2')
  })

  it('키 회전: 이전 secret 무효 + DB 해시 갱신', async () => {
    const t = await tenants.signup({ name: 'Acme' })
    const rotated = await tenants.rotateKeys(t.id)
    expect(await tenants.authenticateBySecretKey(t.secretKey)).toBeNull()
    expect((await tenants.authenticateBySecretKey(rotated.secretKey))?.id).toBe(t.id)
  })

  it('수정: corsOrigins 영속화', async () => {
    const t = await tenants.signup({ name: 'Acme' })
    const up = await tenants.update(t.id, { corsOrigins: ['https://a.example'] })
    expect(up.corsOrigins).toEqual(['https://a.example'])
    const fresh = await tenants.getById(t.id)
    expect(fresh.corsOrigins).toEqual(['https://a.example'])
  })

  it('사용량: record/getUsage 가 DB upsert 로 누적', async () => {
    const t = await tenants.signup({ name: 'Acme' })
    await usage.record(t.id, 'api_calls', 3)
    await usage.record(t.id, 'api_calls', 2)
    await usage.record(t.id, 'events', 7)
    const u = await usage.getUsage(t.id)
    expect(u.api_calls).toBe(5)
    expect(u.events).toBe(7)
    expect(u.storage_mb).toBe(0)
  })

  it('사용량: free 한도 집행(checkAllowed)', async () => {
    const t = await tenants.signup({ name: 'Acme', plan: 'free' })
    await usage.record(t.id, 'events', 1_000) // free events 한도 1_000
    const r = await usage.checkAllowed(t.id, 'free', 'events')
    expect(r.allowed).toBe(false)
    expect(r.remaining).toBe(0)
  })

  it('사용량: reset', async () => {
    const t = await tenants.signup({ name: 'Acme' })
    await usage.record(t.id, 'api_calls', 9)
    await usage.reset(t.id)
    expect(await usage.getMetric(t.id, 'api_calls')).toBe(0)
  })

  it('플랜 변경 후 한도 상향 반영', async () => {
    const t = await tenants.signup({ name: 'Acme', plan: 'free' })
    await usage.record(t.id, 'events', 1_000)
    expect((await usage.checkAllowed(t.id, 'free', 'events')).allowed).toBe(false)
    await tenants.setPlan(t.id, 'pro')
    const fresh = await tenants.getById(t.id)
    expect((await usage.checkAllowed(t.id, fresh.plan, 'events')).allowed).toBe(true)
  })
})
