import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { hashSecretKey } from '../common/keys'
import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'

import { TenantsService } from './tenants.service'

import type { Database, DatabaseService } from '../db/database.service'

async function makeService(): Promise<{ dbs: DatabaseService; service: TenantsService }> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  return { dbs, service: new TenantsService(dbs) }
}

describe('TenantsService (PGlite)', () => {
  let service: TenantsService

  beforeEach(async () => {
    ;({ service } = await makeService())
  })

  it('가입 시 pk_/sk_ 키를 발급하고 secret 은 해시로만 저장', async () => {
    const res = await service.createTenant({ name: 'Acme', corsOrigins: ['https://acme.example'] })
    expect(res.publishableKey.startsWith('pk_')).toBe(true)
    expect(res.secretKey.startsWith('sk_')).toBe(true)
    expect(res.tenant.plan).toBe('free')
    expect(res.tenant.usageCount).toBe(0)

    const row = await service.findById(res.tenant.id)
    expect(row).toBeTruthy()
    expect((row as { secretKeyHash: string }).secretKeyHash).toBe(hashSecretKey(res.secretKey))
    expect((row as { secretKeyHash: string }).secretKeyHash).not.toContain(res.secretKey)
  })

  it('name 에서 slug 자동 생성, 충돌 시 접미사', async () => {
    const a = await service.createTenant({ name: 'My Shop', corsOrigins: [] })
    const b = await service.createTenant({ name: 'My Shop!', corsOrigins: [] })
    expect(a.tenant.slug).toBe('my-shop')
    expect(b.tenant.slug).toBe('my-shop-2')
  })

  it('findByPublishableKey / findBySecretKey 로 테넌트 해석', async () => {
    const res = await service.createTenant({ name: 'X', corsOrigins: [] })
    expect((await service.findByPublishableKey(res.publishableKey))?.id).toBe(res.tenant.id)
    expect((await service.findBySecretKey(res.secretKey))?.id).toBe(res.tenant.id)
    expect(await service.findByPublishableKey('pk_nope')).toBeNull()
    expect(await service.findBySecretKey('sk_nope')).toBeNull()
  })

  it('incrementUsage 가 누적 증가', async () => {
    const res = await service.createTenant({ name: 'X', corsOrigins: [] })
    expect(await service.incrementUsage(res.tenant.id)).toBe(1)
    expect(await service.incrementUsage(res.tenant.id)).toBe(2)
  })

  it('rotateKeys 가 새 키를 발급하고 기존 키를 무효화', async () => {
    const res = await service.createTenant({ name: 'X', corsOrigins: [] })
    const oldPk = res.publishableKey
    const oldSk = res.secretKey

    const rotated = await service.rotateKeys(res.tenant.id)
    expect(rotated.publishableKey).not.toBe(oldPk)
    expect(rotated.secretKey).not.toBe(oldSk)

    expect(await service.findByPublishableKey(oldPk)).toBeNull()
    expect(await service.findBySecretKey(oldSk)).toBeNull()
    expect((await service.findByPublishableKey(rotated.publishableKey))?.id).toBe(res.tenant.id)
    expect((await service.findBySecretKey(rotated.secretKey))?.id).toBe(res.tenant.id)
  })

  it('updateTenant 가 설정을 부분 갱신', async () => {
    const res = await service.createTenant({ name: 'X', corsOrigins: [] })
    const updated = await service.updateTenant(res.tenant.id, {
      corsOrigins: ['https://a.example', 'https://b.example'],
      plan: 'pro',
    })
    expect(updated.corsOrigins).toEqual(['https://a.example', 'https://b.example'])
    expect(updated.plan).toBe('pro')
    expect(updated.name).toBe('X') // 미지정 필드는 유지
  })
})
