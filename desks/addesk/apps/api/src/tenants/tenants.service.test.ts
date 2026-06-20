import { PUBLISHABLE_KEY_PREFIX, SECRET_KEY_PREFIX } from '@addesk/shared'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { loadConfig, type AppConfig } from '../config'
import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'

import { TenantsService } from './tenants.service'

import type { Database, DatabaseService } from '../db/database.service'

async function makeService(): Promise<{ dbs: DatabaseService; service: TenantsService }> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  const cfg: AppConfig = { ...loadConfig(), keyPepper: 'it-pepper' }
  return { dbs, service: new TenantsService(dbs, cfg) }
}

describe('TenantsService 가입·인증 (PGlite)', () => {
  let service: TenantsService

  beforeEach(async () => {
    ;({ service } = await makeService())
  })

  it('가입 시 pk_/sk_ 키쌍을 발급하고 secret 평문은 1회만 노출', async () => {
    const creds = await service.signup({ name: 'Acme Inc', corsOrigins: [] })
    expect(creds.publishableKey.startsWith(PUBLISHABLE_KEY_PREFIX)).toBe(true)
    expect(creds.secretKey.startsWith(SECRET_KEY_PREFIX)).toBe(true)
    expect(creds.tenant.slug).toBe('acme-inc')
    expect(creds.tenant.plan).toBe('free')
    // DTO 에는 secret 평문/해시가 없다.
    const row = await service.findByPublishableKey(creds.publishableKey)
    const dto = service.toDto(row!)
    expect(dto).not.toHaveProperty('secretKey')
    expect(dto).not.toHaveProperty('secretKeyHash')
  })

  it('slug 충돌 시 자동 보정(-2)', async () => {
    const a = await service.signup({ name: 'Dup', corsOrigins: [] })
    const b = await service.signup({ name: 'Dup', corsOrigins: [] })
    expect(a.tenant.slug).toBe('dup')
    expect(b.tenant.slug).toBe('dup-2')
  })

  it('secret 키로 테넌트를 조회(올바른 키만 통과)', async () => {
    const creds = await service.signup({ name: 'Acme', corsOrigins: [] })
    const found = await service.findBySecretKey(creds.secretKey)
    expect(found?.id).toBe(creds.tenant.id)
    // 위조 키는 실패
    expect(await service.findBySecretKey('sk_wrongwrongwrong')).toBeNull()
  })

  it('publishable 키로 테넌트를 조회', async () => {
    const creds = await service.signup({ name: 'Acme', corsOrigins: [] })
    const found = await service.findByPublishableKey(creds.publishableKey)
    expect(found?.id).toBe(creds.tenant.id)
    expect(await service.findByPublishableKey('pk_nope')).toBeNull()
  })

  it('키 로테이션이 이전 키를 무효화한다', async () => {
    const creds = await service.signup({ name: 'Acme', corsOrigins: [] })
    const rotated = await service.rotateKeys(creds.tenant.id)
    expect(rotated.publishableKey).not.toBe(creds.publishableKey)
    expect(rotated.secretKey).not.toBe(creds.secretKey)
    // 옛 키는 더 이상 매칭되지 않음
    expect(await service.findBySecretKey(creds.secretKey)).toBeNull()
    expect(await service.findByPublishableKey(creds.publishableKey)).toBeNull()
    // 새 키는 동작
    expect((await service.findBySecretKey(rotated.secretKey))?.id).toBe(creds.tenant.id)
  })

  it('corsOrigins 를 그대로 저장', async () => {
    const wild = await service.signup({ name: 'A', corsOrigins: ['*'] })
    expect(wild.tenant.corsOrigins).toEqual(['*'])
    const scoped = await service.signup({
      name: 'B',
      corsOrigins: ['https://app.example.com'],
    })
    expect(scoped.tenant.corsOrigins).toEqual(['https://app.example.com'])
  })

  it('update 가 name·corsOrigins·plan 을 갱신', async () => {
    const creds = await service.signup({ name: 'Old', corsOrigins: [] })
    const updated = await service.update(creds.tenant.id, {
      name: 'New',
      plan: 'pro',
      corsOrigins: ['https://x.test'],
    })
    expect(updated.name).toBe('New')
    expect(updated.plan).toBe('pro')
    expect(updated.corsOrigins).toEqual(['https://x.test'])
  })

  it('incrementUsage 가 누적 카운터를 1씩 증가', async () => {
    const creds = await service.signup({ name: 'C', corsOrigins: [] })
    expect(await service.incrementUsage(creds.tenant.id)).toBe(1)
    expect(await service.incrementUsage(creds.tenant.id)).toBe(2)
  })

  it('incrementUsageUnder 가 한도 미만이면 증가(true)·도달이면 거절(false)', async () => {
    const creds = await service.signup({ name: 'C', corsOrigins: [] })
    // 한도 2 — 0→1, 1→2 까지는 성공.
    expect(await service.incrementUsageUnder(creds.tenant.id, 2)).toBe(true)
    expect(await service.incrementUsageUnder(creds.tenant.id, 2)).toBe(true)
    // 이미 2(한도)면 증가 실패 → 오버슈트 없음.
    expect(await service.incrementUsageUnder(creds.tenant.id, 2)).toBe(false)
    const row = await service.findById(creds.tenant.id)
    expect(row?.usageCount).toBe(2)
  })
})
