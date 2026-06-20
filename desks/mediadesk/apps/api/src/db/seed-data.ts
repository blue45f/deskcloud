import { deflateSync } from 'node:zlib'

import { sql } from 'drizzle-orm'

import { hashSecretKey } from '../common/keys'

import { DatabaseService } from './database.service'
import { assets, tenants } from './schema'

import type { AppConfig } from '../config'
import type { StorageService } from '../storage/storage.service'

/**
 * 데모 테넌트 — self-hosted 첫 부팅 시 멱등 시드. 키는 데모용 고정값이라 대시보드/위젯에서
 * 바로 붙여 쓸 수 있다(운영에서는 회전 권장). secret 은 해시만 저장(평문은 아래 주석/문서).
 *   publishable: pk_demo_publishable_key_0000000000
 *   secret:      sk_demo_secret_key_00000000000000   (해시 저장)
 */
export const DEMO_PUBLISHABLE_KEY = 'pk_demo_publishable_key_0000000000'
export const DEMO_SECRET_KEY = 'sk_demo_secret_key_00000000000000'
export const DEMO_TENANT_SLUG = 'demo'

interface SeedAsset {
  key: string
  folder: string | null
  color: [number, number, number]
}

const SEED_ASSETS: SeedAsset[] = [
  { key: 'avatars/seed01-coral.png', folder: 'avatars', color: [233, 116, 99] },
  { key: 'avatars/seed02-sky.png', folder: 'avatars', color: [96, 165, 214] },
  { key: 'avatars/seed03-mint.png', folder: 'avatars', color: [104, 196, 160] },
  { key: 'banners/seed04-amber.png', folder: 'banners', color: [230, 184, 115] },
  { key: 'banners/seed05-violet.png', folder: 'banners', color: [150, 130, 220] },
  { key: 'seed06-slate.png', folder: null, color: [90, 100, 120] },
]

export interface SeedResult {
  seeded: boolean
}

/**
 * 멱등 시드 — 테넌트가 하나도 없을 때만 데모 테넌트 + 샘플 이미지(실제 PNG 바이트)를 채운다.
 */
export async function runSeed(
  dbs: DatabaseService,
  storage: StorageService,
  cfg: AppConfig,
  opts: { demo: boolean }
): Promise<SeedResult> {
  if (!opts.demo) return { seeded: false }

  const existing = await dbs.db.select({ c: sql<number>`count(*)` }).from(tenants)
  if (Number(existing[0]?.c ?? 0) > 0) return { seeded: false }

  const inserted = await dbs.db
    .insert(tenants)
    .values({
      slug: DEMO_TENANT_SLUG,
      name: '데모 워크스페이스',
      plan: 'free',
      publishableKey: DEMO_PUBLISHABLE_KEY,
      secretKeyHash: hashSecretKey(DEMO_SECRET_KEY),
      // 데모는 어디서든 붙여 볼 수 있게 전체 허용. 운영 테넌트는 명시 origin 권장.
      corsOrigins: ['*'],
      storageDriver: cfg.storageDriver,
    })
    .returning()
  const tenant = inserted[0]!

  let totalBytes = 0
  const rows: (typeof assets.$inferInsert)[] = []
  for (const a of SEED_ASSETS) {
    const png = makeSolidPng(64, 64, a.color)
    totalBytes += png.byteLength
    await storage.get().put(`${tenant.slug}/${a.key}`, png, 'image/png')
    rows.push({
      tenantId: tenant.id,
      key: a.key,
      folder: a.folder,
      contentType: 'image/png',
      size: png.byteLength,
      width: 64,
      height: 64,
    })
  }
  await dbs.db.insert(assets).values(rows)
  await dbs.db
    .update(tenants)
    .set({ usageBytes: totalBytes, usageCount: rows.length })
    .where(sql`${tenants.id} = ${tenant.id}`)

  return { seeded: true }
}

// ── 의존성 없는 PNG 인코더(시드 이미지용 단색 64x64) ─────────────────────────────
// sharp 없이도 실제 PNG 바이트를 생성해, 갤러리에 진짜 썸네일이 뜨도록 한다.

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i]!
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function makeSolidPng(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.writeUInt8(8, 8) // bit depth
  ihdr.writeUInt8(2, 9) // color type: RGB
  ihdr.writeUInt8(0, 10) // compression
  ihdr.writeUInt8(0, 11) // filter
  ihdr.writeUInt8(0, 12) // interlace

  // raw scanlines: 각 행 앞에 filter byte(0) + RGB 픽셀.
  const rowLen = 1 + width * 3
  const raw = Buffer.alloc(rowLen * height)
  for (let y = 0; y < height; y += 1) {
    const off = y * rowLen
    raw[off] = 0
    for (let x = 0; x < width; x += 1) {
      const p = off + 1 + x * 3
      raw[p] = r
      raw[p + 1] = g
      raw[p + 2] = b
    }
  }
  // deflateSync 는 완전한 zlib 스트림(헤더 + deflate + adler32)을 반환 — PNG IDAT 규약과 일치.
  const idatData = deflateSync(raw)

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
