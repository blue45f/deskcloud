import { eq, sql } from 'drizzle-orm'

import { DatabaseService } from '../../db/database.service'
import { fileBlobs } from '../../db/schema'

import type { PutResult, StorageAdapter } from './storage.adapter'

/**
 * Postgres-bytea 어댑터(v1 기본) — 작은 파일 바이트를 `file_blobs.bytes`(bytea)에 인라인 저장.
 * 외부 인프라가 필요 없어 PGlite 폴백에서도 그대로 동작한다(로컬·도커·서버리스 동일).
 *
 * 프로덕션에서 큰 파일/대량 트래픽이면 S3/R2 어댑터로 스왑한다(DESK_STORAGE_DRIVER=s3).
 */
export class PostgresStorageAdapter implements StorageAdapter {
  readonly driver = 'postgres' as const

  constructor(private readonly dbs: DatabaseService) {}

  async put(fileId: string, bytes: Buffer): Promise<PutResult> {
    // upsert: 같은 fileId 로 다시 저장하면 덮어쓴다(레지스트리 행과 1:1).
    await this.dbs.db
      .insert(fileBlobs)
      .values({ fileId, bytes })
      .onConflictDoUpdate({ target: fileBlobs.fileId, set: { bytes } })
    return { storageRef: null }
  }

  async get(fileId: string): Promise<Buffer | null> {
    const rows = await this.dbs.db
      .select({ bytes: fileBlobs.bytes })
      .from(fileBlobs)
      .where(eq(fileBlobs.fileId, fileId))
      .limit(1)
    const raw = rows[0]?.bytes
    if (raw == null) return null
    // node-postgres 는 Buffer, PGlite 는 Uint8Array 를 줄 수 있어 정규화한다.
    return Buffer.isBuffer(raw) ? raw : Buffer.from(raw as unknown as Uint8Array)
  }

  async delete(fileId: string): Promise<void> {
    await this.dbs.db.delete(fileBlobs).where(eq(fileBlobs.fileId, fileId))
  }

  /** 총 저장 바이트 — 통계용(레지스트리의 size_bytes 합과 일치해야 함). */
  async totalBytes(): Promise<number> {
    const rows = await this.dbs.db
      .select({ total: sql<number>`coalesce(sum(octet_length(${fileBlobs.bytes})), 0)::bigint` })
      .from(fileBlobs)
    return Number(rows[0]?.total ?? 0)
  }
}
