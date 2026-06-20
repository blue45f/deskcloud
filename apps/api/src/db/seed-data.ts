import { generateFileKey, type Visibility } from '@filedesk/shared'
import { sql } from 'drizzle-orm'

import { hashSecret, lookupHash } from '../common/secret'

import { DatabaseService } from './database.service'
import { fileBlobs, fileObjects, tenants } from './schema'

const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

/** 데모 테넌트 — 고정 키(pk_demo/sk_demo)로 로컬 검증/문서가 바로 동작하도록. */
const DEMO = {
  name: 'Demo Co',
  slug: 'demo',
  publishableKey: 'pk_demo',
  secretKey: 'sk_demo',
  corsOrigins: ['*'],
} as const

/** 작은 텍스트 파일 바이트 생성(시드 — 실제 바이트가 있어 서빙/통계가 비지 않도록). */
function textBlob(body: string): { bytes: Buffer; contentType: string } {
  return { bytes: Buffer.from(body, 'utf8'), contentType: 'text/plain' }
}

/** 1x1 투명 PNG(base64) — 이미지 데모용 최소 바이트. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

interface DemoFile {
  filename: string
  contentType: string
  bytes: Buffer
  visibility: Visibility
  ageDays: number
}

function buildDemoFiles(): DemoFile[] {
  const readme = textBlob('# FileDesk\n샘플 파일입니다. publishable 키로 업로드하고 secret 키로 관리하세요.\n')
  const notes = textBlob('회의 노트 — 데모 시드.\n- 업로드 위젯\n- 스토리지 어댑터\n- 서명 URL\n')
  const csv = { bytes: Buffer.from('name,size\nlogo.png,68\nreadme.md,90\n', 'utf8'), contentType: 'text/csv' }
  return [
    { filename: 'logo.png', contentType: 'image/png', bytes: TINY_PNG, visibility: 'public', ageDays: 1 },
    { filename: 'readme.md', contentType: readme.contentType, bytes: readme.bytes, visibility: 'public', ageDays: 2 },
    { filename: 'report.csv', contentType: csv.contentType, bytes: csv.bytes, visibility: 'private', ageDays: 3 },
    { filename: 'meeting-notes.txt', contentType: notes.contentType, bytes: notes.bytes, visibility: 'private', ageDays: 5 },
  ]
}

export interface SeedResult {
  seeded: boolean
}

/**
 * 멱등 시드 — 테넌트가 하나도 없을 때만 데모 테넌트 + 샘플 파일(레지스트리 + bytea 바이트)을 채운다.
 * (자료가 이미 있으면 건너뜀.) 시드는 postgres-bytea 경로로 바이트를 직접 기록한다.
 */
export async function runSeed(
  dbs: DatabaseService,
  opts: { demo: boolean; pepper: string }
): Promise<SeedResult> {
  if (!opts.demo) return { seeded: false }

  const existing = await dbs.db.select({ c: sql<number>`count(*)` }).from(tenants)
  if (Number(existing[0]?.c ?? 0) > 0) return { seeded: false }

  const tenantRows = await dbs.db
    .insert(tenants)
    .values({
      name: DEMO.name,
      slug: DEMO.slug,
      plan: 'free',
      publishableKey: DEMO.publishableKey,
      secretKeyHash: hashSecret(DEMO.secretKey, opts.pepper),
      secretKeyLookup: lookupHash(DEMO.secretKey, opts.pepper),
      corsOrigins: [...DEMO.corsOrigins],
      usageCount: 0,
    })
    .returning({ id: tenants.id })
  const tenantId = tenantRows[0]!.id

  const demoFiles = buildDemoFiles()
  for (const f of demoFiles) {
    const inserted = await dbs.db
      .insert(fileObjects)
      .values({
        tenantId,
        key: generateFileKey(),
        filename: f.filename,
        contentType: f.contentType,
        sizeBytes: f.bytes.length,
        visibility: f.visibility,
        storageDriver: 'postgres',
        storageRef: null,
        createdAt: daysAgo(f.ageDays),
      })
      .returning({ id: fileObjects.id })
    await dbs.db.insert(fileBlobs).values({ fileId: inserted[0]!.id, bytes: f.bytes })
  }

  // 누적 업로드 카운터를 시드 파일 수만큼 반영.
  await dbs.db
    .update(tenants)
    .set({ usageCount: demoFiles.length })
    .where(sql`${tenants.id} = ${tenantId}`)

  return { seeded: true }
}
