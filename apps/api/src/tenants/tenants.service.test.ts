import { PGlite } from '@electric-sql/pglite'
import { isPublishableKey, isSecretKey } from '@searchdesk/shared'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'

import { TenantsService } from './tenants.service'

import type { Database, DatabaseService } from '../db/database.service'

/** PGlite 인메모리 DB + 이식성 마이그레이션을 적용한 가짜 DatabaseService. */
async function makeService(): Promise<{ dbs: DatabaseService; service: TenantsService }> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) {
    if (m.only && !m.only.includes('pglite')) continue
    await client.exec(m.sql)
  }
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
    // 일반 조회(DTO)에는 secret 평문/해시가 없다.
    const row = await service.findByPublishableKey(creds.publishableKey)
    const dto = service.toDto(row!)
    expect(dto).not.toHaveProperty('secretKey')
    expect(dto).not.toHaveProperty('secretKeyHash')
    expect(dto.docCount).toBe(0)
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
    expect(await service.findBySecretKey(creds.secretKey)).toBeNull()
    expect(await service.findByPublishableKey(creds.publishableKey)).toBeNull()
    expect((await service.findBySecretKey(rotated.secretKey))?.id).toBe(creds.id)
  })

  it('corsOrigins 기본값은 ["*"], 지정 시 그대로 저장', async () => {
    const wild = await service.signup({ name: 'A' })
    expect(wild.corsOrigins).toEqual(['*'])
    const scoped = await service.signup({ name: 'B', corsOrigins: ['https://app.example.com'] })
    expect(scoped.corsOrigins).toEqual(['https://app.example.com'])
  })

  it('문서 카운트 증가/소프트 캡 판정/롤백', async () => {
    const creds = await service.signup({ name: 'A', plan: 'free' })
    const first = await service.addDocCount(creds.id, 'free', 1, 1)
    expect(first.overCap).toBe(false)
    expect(first.docCount).toBe(1)
    const second = await service.addDocCount(creds.id, 'free', 1, 1)
    expect(second.overCap).toBe(true)
    expect(second.docCount).toBe(2)
    // 롤백
    await service.subtractDocCount(creds.id, 1)
    const row = await service.getById(creds.id)
    expect(row.docCount).toBe(1)
  })

  it('pro 플랜은 캡 무제한', async () => {
    const creds = await service.signup({ name: 'A', plan: 'pro' })
    const r = await service.addDocCount(creds.id, 'pro', 5000, 1)
    expect(r.overCap).toBe(false)
  })

  it('검색 카운트 증가', async () => {
    const creds = await service.signup({ name: 'A' })
    expect(await service.incrementSearchCount(creds.id)).toBe(1)
    expect(await service.incrementSearchCount(creds.id)).toBe(2)
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
