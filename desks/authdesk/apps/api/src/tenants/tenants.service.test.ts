import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { loadConfig, type AppConfig } from '../config'
import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'

import { TenantsService } from './tenants.service'

import type { Database, DatabaseService } from '../db/database.service'

const PEPPER = 'it-pepper'

async function makeService(): Promise<{ dbs: DatabaseService; tenants: TenantsService }> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  const cfg: AppConfig = { ...loadConfig(), keyPepper: PEPPER }
  return { dbs, tenants: new TenantsService(dbs, cfg) }
}

const INPUT = { name: 'Acme', slug: 'acme', plan: 'free' as const, corsOrigins: [] }

describe('TenantsService.signup (PGlite)', () => {
  let tenants: TenantsService

  beforeEach(async () => {
    ;({ tenants } = await makeService())
  })

  it('가입 — pk_/sk_ 발급, secret 평문은 응답에서만', async () => {
    const t = await tenants.signup(INPUT)
    expect(t.publishableKey.startsWith('pk_')).toBe(true)
    expect(t.secretKey.startsWith('sk_')).toBe(true)
    expect(t).not.toHaveProperty('secretKeyHash')
  })

  it('사전 SELECT 로 잡히는 명시 중복 slug 는 409', async () => {
    await tenants.signup(INPUT)
    await expect(tenants.signup(INPUT)).rejects.toMatchObject({ status: 409 })
  })

  it('동시 동일 slug 가입 경합 — 하나는 성공, 나머지는 409(500 아님)', async () => {
    const results = await Promise.allSettled([
      tenants.signup(INPUT),
      tenants.signup(INPUT),
      tenants.signup(INPUT),
    ])
    const ok = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    expect(ok).toHaveLength(1)
    // 경합에 진 INSERT 는 유니크 위반(23505)을 던지지만 ConflictException(409)으로 매핑돼야 한다.
    for (const r of rejected) {
      expect((r.reason as { status?: number }).status).toBe(409)
    }
  })
})
