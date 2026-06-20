import { PGlite } from '@electric-sql/pglite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { hashSecret, lookupHash, verifyFileToken } from '../common/secret'
import { loadConfig, type AppConfig } from '../config'
import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { tenants } from '../db/schema'

import { FilesService } from './files.service'
import { PostgresStorageAdapter } from './storage/postgres-storage.adapter'

import type { Database, DatabaseService } from '../db/database.service'

const PEPPER = 'it-pepper'

async function makeStack(overrides: Partial<AppConfig> = {}): Promise<{
  dbs: DatabaseService
  files: FilesService
  storage: PostgresStorageAdapter
  cfg: AppConfig
}> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  const cfg: AppConfig = { ...loadConfig(), keyPepper: PEPPER, storageDriver: 'postgres', ...overrides }
  const storage = new PostgresStorageAdapter(dbs)
  const files = new FilesService(dbs, storage, cfg)
  return { dbs, files, storage, cfg }
}

async function seedTenant(
  dbs: DatabaseService,
  plan: 'free' | 'pro' = 'pro'
): Promise<{ id: string; plan: string }> {
  const rows = await dbs.db
    .insert(tenants)
    .values({
      name: 'Acme',
      slug: `acme-${Math.random().toString(36).slice(2, 8)}`,
      plan,
      publishableKey: `pk_${Math.random().toString(36).slice(2)}`,
      secretKeyHash: hashSecret('sk_x', PEPPER),
      secretKeyLookup: lookupHash('sk_x', PEPPER),
      corsOrigins: ['*'],
      usageCount: 0,
    })
    .returning({ id: tenants.id, plan: tenants.plan })
  return rows[0]!
}

const PNG = Buffer.from('iVBORw0KGgo=', 'base64') // 작은 더미 바이트

describe('FilesService (PGlite + Postgres-bytea 어댑터)', () => {
  let dbs: DatabaseService
  let files: FilesService

  beforeEach(async () => {
    ;({ dbs, files } = await makeStack())
  })

  it('업로드 → { id, key, url } 반환 + 바이트 라운드트립', async () => {
    const tenant = await seedTenant(dbs)
    const out = await files.upload(tenant, 'https://files.example.com', {
      filename: 'hello.png',
      contentType: 'image/png',
      bytes: PNG,
      visibility: 'public',
    })
    expect(out.id).toBeTruthy()
    expect(out.key).toMatch(/^[A-Za-z0-9]+$/)
    expect(out.url).toBe(`https://files.example.com/api/files/${out.key}`)
    expect(out.sizeBytes).toBe(PNG.length)

    const row = await files.getByKey(out.key)
    const served = await files.loadBytes(row)
    expect(served.bytes.equals(PNG)).toBe(true)
    expect(served.contentType).toBe('image/png')
  })

  it('허용되지 않는 MIME 은 400 으로 거부한다', async () => {
    const tenant = await seedTenant(dbs)
    await expect(
      files.upload(tenant, '', {
        filename: 'x.exe',
        contentType: 'application/x-msdownload',
        bytes: PNG,
        visibility: 'public',
      })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('최대 크기 초과는 413 으로 거부한다', async () => {
    const { files: f, dbs: d } = await makeStack({ maxFileBytes: 8 })
    const tenant = await seedTenant(d)
    await expect(
      f.upload(tenant, '', {
        filename: 'big.png',
        contentType: 'image/png',
        bytes: Buffer.alloc(9, 1),
        visibility: 'public',
      })
    ).rejects.toMatchObject({ status: 413 })
  })

  it('free 플랜 파일 수 소프트 캡을 집행하고 카운터를 롤백한다', async () => {
    const { files: f, dbs: d } = await makeStack({ freePlanFileCap: 1 })
    const tenant = await seedTenant(d, 'free')
    await f.upload(tenant, '', { filename: 'a.png', contentType: 'image/png', bytes: PNG, visibility: 'public' })
    // 두 번째는 캡 초과 → 403
    await expect(
      f.upload(tenant, '', { filename: 'b.png', contentType: 'image/png', bytes: PNG, visibility: 'public' })
    ).rejects.toMatchObject({ status: 403 })
    // 거부된 업로드는 카운터를 되돌려 usageCount=1 유지
    const rows = await d.db.select({ c: tenants.usageCount }).from(tenants).where(eq(tenants.id, tenant.id))
    expect(Number(rows[0]?.c)).toBe(1)
  })

  it('목록·통계가 개수와 총 바이트를 집계한다', async () => {
    const tenant = await seedTenant(dbs)
    await files.upload(tenant, '', { filename: 'a.png', contentType: 'image/png', bytes: Buffer.alloc(10, 1), visibility: 'public' })
    await files.upload(tenant, '', { filename: 'b.txt', contentType: 'text/plain', bytes: Buffer.alloc(20, 1), visibility: 'private' })

    const list = await files.list(tenant.id, {})
    expect(list.total).toBe(2)
    expect(list.items).toHaveLength(2)

    const onlyPrivate = await files.list(tenant.id, { visibility: 'private' })
    expect(onlyPrivate.total).toBe(1)

    const stats = await files.stats(tenant.id)
    expect(stats.metrics.files).toBe(2)
    expect(stats.metrics.storage_bytes).toBe(30)
    expect(stats.byVisibility.find((v) => v.visibility === 'private')?.files).toBe(1)
  })

  it('삭제가 레지스트리와 바이트를 모두 제거한다', async () => {
    const tenant = await seedTenant(dbs)
    const up = await files.upload(tenant, '', { filename: 'a.png', contentType: 'image/png', bytes: PNG, visibility: 'public' })
    await files.delete(up.id, tenant.id)
    await expect(files.getByKey(up.key)).rejects.toMatchObject({ status: 404 })
  })

  it('다른 테넌트의 파일은 삭제할 수 없다(404)', async () => {
    const a = await seedTenant(dbs)
    const b = await seedTenant(dbs)
    const up = await files.upload(a, '', { filename: 'a.png', contentType: 'image/png', bytes: PNG, visibility: 'public' })
    await expect(files.delete(up.id, b.id)).rejects.toMatchObject({ status: 404 })
  })

  it('private 파일의 서명 토큰이 검증을 통과한다', async () => {
    const tenant = await seedTenant(dbs)
    const up = await files.upload(tenant, '', { filename: 's.png', contentType: 'image/png', bytes: PNG, visibility: 'private' })
    const row = await files.getById(up.id, tenant.id)
    const signed = files.signUrl(row, 'https://files.example.com', 300)
    expect(signed.url).toContain(`token=`)
    expect(verifyFileToken(row.id, signed.token, PEPPER)).toBe(true)
    // 다른 파일 id 로는 통과하지 못한다
    expect(verifyFileToken('00000000-0000-0000-0000-000000000000', signed.token, PEPPER)).toBe(false)
  })
})
