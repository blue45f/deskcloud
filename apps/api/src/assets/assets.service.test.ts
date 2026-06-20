import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadConfig, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { StorageService } from '../storage/storage.service'
import { TenantsService } from '../tenants/tenants.service'
import { TransformService } from '../transform/transform.service'

import { AssetsService, type UploadFile } from './assets.service'

// 1x1 흰색 PNG (유효한 최소 PNG).
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64'
)

function file(name: string, mime: string, body: Buffer): UploadFile {
  return { buffer: body, mimetype: mime, originalname: name, size: body.byteLength }
}

describe('AssetsService (PGlite + local storage)', () => {
  let tmp: string
  let dbs: DatabaseService
  let storage: StorageService
  let transform: TransformService
  let tenants: TenantsService
  let assets: AssetsService
  let cfg: AppConfig

  const BASE = 'http://localhost:4191'

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'mediadesk-test-'))
    process.env.DATABASE_URL = ''
    process.env.PGLITE_DIR = join(tmp, 'pg')
    process.env.STORAGE_LOCAL_DIR = join(tmp, 'uploads')
    process.env.DERIVATIVE_CACHE_DIR = join(tmp, 'deriv')
    process.env.FREE_PLAN_MAX_BYTES = '1000000'
    process.env.FREE_PLAN_MAX_COUNT = '50'
    cfg = loadConfig()

    dbs = new DatabaseService(cfg)
    await dbs.onModuleInit()
    storage = new StorageService(cfg)
    transform = new TransformService(cfg)
    await transform.onModuleInit() // sharp 없어도 안전
    tenants = new TenantsService(dbs, cfg)
    assets = new AssetsService(dbs, storage, transform, tenants, cfg)
  })

  afterEach(async () => {
    await dbs.onModuleDestroy()
    rmSync(tmp, { recursive: true, force: true })
  })

  it('signup → upload → list → serve → delete 전체 흐름', async () => {
    const { tenant, secretKey } = await tenants.signup({ name: 'Acme Co' })
    expect(tenant.slug).toBe('acme-co')
    expect(tenant.publishableKey.startsWith('pk_')).toBe(true)
    expect(secretKey.startsWith('sk_')).toBe(true)

    const row = await tenants.findById(tenant.id)
    expect(row).not.toBeNull()

    const asset = await assets.upload(
      row!,
      file('Photo 1.png', 'image/png', PNG_1x1),
      'avatars',
      BASE
    )
    expect(asset.contentType).toBe('image/png')
    expect(asset.folder).toBe('avatars')
    expect(asset.transformable).toBe(true)
    expect(asset.url).toContain('/file/acme-co/avatars/')
    // random 세그먼트는 base62(대소문자+숫자), 파일명은 소문자로 정제됨.
    expect(asset.key).toMatch(/^avatars\/[A-Za-z0-9]+-photo-1\.png$/)

    const list = await assets.list(row!, { folder: 'avatars' }, BASE)
    expect(list.total).toBe(1)
    expect(list.items[0]!.key).toBe(asset.key)

    // 사용량 증가 반영.
    const afterUpload = await tenants.findById(tenant.id)
    expect(afterUpload!.usageCount).toBe(1)
    expect(Number(afterUpload!.usageBytes)).toBe(PNG_1x1.byteLength)

    // 서빙(변환 요청 — sharp 없으면 원본으로 graceful fallback).
    const served = await assets.serve('acme-co', asset.key, { w: 32, format: 'webp' })
    expect(served.body.byteLength).toBeGreaterThan(0)
    // sharp 없으면 원본 png, 있으면 webp — 둘 다 허용.
    expect(['image/png', 'image/webp']).toContain(served.contentType)

    // 삭제 → 사용량 감소.
    const del = await assets.delete(row!, asset.key)
    expect(del.deleted).toBe(true)
    const afterDelete = await tenants.findById(tenant.id)
    expect(afterDelete!.usageCount).toBe(0)
    expect(Number(afterDelete!.usageBytes)).toBe(0)

    const emptyList = await assets.list(row!, {}, BASE)
    expect(emptyList.total).toBe(0)
  })

  it('허용되지 않는 MIME 는 거부', async () => {
    const { tenant } = await tenants.signup({ name: 'Reject Co' })
    const row = await tenants.findById(tenant.id)
    await expect(
      assets.upload(
        row!,
        file('x.exe', 'application/x-msdownload', Buffer.from('x')),
        undefined,
        BASE
      )
    ).rejects.toThrow()
  })

  it('slug 충돌 시 유일 접미를 붙인다', async () => {
    const a = await tenants.signup({ name: 'Dup' })
    const b = await tenants.signup({ name: 'Dup' })
    expect(a.tenant.slug).toBe('dup')
    expect(b.tenant.slug).not.toBe('dup')
    expect(b.tenant.slug.startsWith('dup-')).toBe(true)
  })

  it('키 회전 후 이전 secret 키는 무효', async () => {
    const { tenant, secretKey } = await tenants.signup({ name: 'Rotate Co' })
    const before = await tenants.findBySecretKey(secretKey)
    expect(before?.id).toBe(tenant.id)

    const rotated = await tenants.rotateKeys(tenant.id)
    expect(rotated.secretKey).not.toBe(secretKey)

    const afterOld = await tenants.findBySecretKey(secretKey)
    expect(afterOld).toBeNull()
    const afterNew = await tenants.findBySecretKey(rotated.secretKey)
    expect(afterNew?.id).toBe(tenant.id)
  })
})
