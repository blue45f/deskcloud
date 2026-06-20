import { PGlite } from '@electric-sql/pglite'
import { isPublishableKey, isSecretKey } from '@notifydesk/shared'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

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

describe('TenantsService 가입·인증 (PGlite)', () => {
  let service: TenantsService

  beforeEach(async () => {
    ;({ service } = await makeService())
  })

  it('가입 시 pk_/sk_ 키쌍을 발급하고 secret 평문은 1회만 노출', async () => {
    const creds = await service.signup({ name: 'Acme Inc' })
    expect(isPublishableKey(creds.publishableKey)).toBe(true)
    expect(isSecretKey(creds.secretKey)).toBe(true)
    expect(creds.slug).toBe('acme-inc')
    expect(creds.plan).toBe('free')
    // 일반 조회(DTO)에는 secret 평문이 없다.
    const row = await service.findByPublishableKey(creds.publishableKey)
    const dto = service.toDto(row!)
    expect(dto).not.toHaveProperty('secretKey')
    expect(dto).not.toHaveProperty('secretKeyHash')
  })

  it('slug 충돌 시 자동 보정(-2)', async () => {
    const a = await service.signup({ name: 'Dup' })
    const b = await service.signup({ name: 'Dup' })
    expect(a.slug).toBe('dup')
    expect(b.slug).toBe('dup-2')
  })

  it('secret 키로 테넌트를 조회(올바른 키만 통과)', async () => {
    const creds = await service.signup({ name: 'Acme' })
    const found = await service.findBySecretKey(creds.secretKey)
    expect(found?.id).toBe(creds.id)
    // 위조 키는 실패
    expect(await service.findBySecretKey('sk_wrongwrongwrong')).toBeNull()
  })

  it('publishable 키로 테넌트를 조회', async () => {
    const creds = await service.signup({ name: 'Acme' })
    const found = await service.findByPublishableKey(creds.publishableKey)
    expect(found?.id).toBe(creds.id)
    expect(await service.findByPublishableKey('pk_nope')).toBeNull()
  })

  it('키 로테이션이 이전 키를 무효화한다', async () => {
    const creds = await service.signup({ name: 'Acme' })
    const rotated = await service.rotateKeys(creds.id)
    expect(rotated.publishableKey).not.toBe(creds.publishableKey)
    expect(rotated.secretKey).not.toBe(creds.secretKey)
    // 옛 키는 더 이상 매칭되지 않음
    expect(await service.findBySecretKey(creds.secretKey)).toBeNull()
    expect(await service.findByPublishableKey(creds.publishableKey)).toBeNull()
    // 새 키는 동작
    expect((await service.findBySecretKey(rotated.secretKey))?.id).toBe(creds.id)
  })

  it('corsOrigins 기본값은 ["*"], 지정 시 그대로 저장', async () => {
    const wild = await service.signup({ name: 'A' })
    expect(wild.corsOrigins).toEqual(['*'])
    const scoped = await service.signup({
      name: 'B',
      corsOrigins: ['https://app.example.com'],
    })
    expect(scoped.corsOrigins).toEqual(['https://app.example.com'])
  })

  it('사용량 증가/소프트 캡 판정', async () => {
    const creds = await service.signup({ name: 'A', plan: 'free' })
    const first = await service.incrementUsage(creds.id, 'free', 1)
    expect(first.overCap).toBe(false)
    const second = await service.incrementUsage(creds.id, 'free', 1)
    expect(second.overCap).toBe(true)
    // 롤백
    await service.decrementUsage(creds.id)
    const row = await service.getById(creds.id)
    expect(row.usageCount).toBe(1)
  })

  it('update 가 name·corsOrigins·plan 을 갱신', async () => {
    const creds = await service.signup({ name: 'Old' })
    const updated = await service.update(creds.id, {
      name: 'New',
      plan: 'pro',
      corsOrigins: ['https://x.test'],
    })
    expect(updated.name).toBe('New')
    expect(updated.plan).toBe('pro')
    expect(updated.corsOrigins).toEqual(['https://x.test'])
  })
})
