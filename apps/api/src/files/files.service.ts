import {
  generateFileKey,
  UPLOAD_ERROR_MESSAGES,
  validateUpload,
  type FileListDto,
  type FileObjectDto,
  type FileStatsDto,
  type ListFilesQuery,
  type SignedUrlDto,
  type UploadResultDto,
  type UsageMetric,
  type Visibility,
} from '@filedesk/shared'
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { and, desc, eq, sql } from 'drizzle-orm'

import { signFileToken } from '../common/secret'
import { toFileObjectDto } from '../common/serialize'
import { APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { fileObjects, tenants } from '../db/schema'

import { StorageNotConfiguredError, type StorageAdapter } from './storage/storage.adapter'
import { STORAGE_ADAPTER } from './storage/storage.provider'

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 25

function clampLimit(raw?: string, fallback = DEFAULT_LIMIT): number {
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(Number(raw)) || fallback))
}

export interface UploadCommand {
  filename: string
  contentType: string
  bytes: Buffer
  visibility: Visibility
}

/** 파일 바이트 + 메타데이터(서빙 응답용). */
export interface ServedFile {
  filename: string
  contentType: string
  sizeBytes: number
  bytes: Buffer
}

@Injectable()
export class FilesService {
  constructor(
    private readonly dbs: DatabaseService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  /**
   * 업로드 — 검증(크기·MIME) → free 플랜 캡(+1, 초과면 롤백·거부) → 스토리지 put → 레지스트리 insert.
   * 실패 시 부분 상태가 남지 않도록 카운터/블롭을 정리한다.
   */
  async upload(
    tenant: { id: string; plan: string },
    publicBaseUrl: string,
    cmd: UploadCommand
  ): Promise<UploadResultDto> {
    const verdict = validateUpload(
      { filename: cmd.filename, contentType: cmd.contentType, sizeBytes: cmd.bytes.length },
      { maxBytes: this.cfg.maxFileBytes }
    )
    if (!verdict.ok) {
      const messages = verdict.errors.map((e) => UPLOAD_ERROR_MESSAGES[e])
      if (verdict.errors.includes('size-too-large')) {
        throw new PayloadTooLargeException(messages)
      }
      throw new BadRequestException(messages)
    }

    // free 플랜 소프트 캡 — 원자적 증가 후 초과 판정(동시성 안전).
    const { overCap } = await this.incrementUsage(tenant.id, tenant.plan)
    if (overCap) {
      await this.decrementUsage(tenant.id)
      throw new ForbiddenException(
        `무료 플랜 파일 수 한도(${this.cfg.freePlanFileCap})를 초과했습니다. 플랜을 업그레이드하세요.`
      )
    }

    const key = await this.uniqueKey(tenant.id)
    const inserted = await this.dbs.db
      .insert(fileObjects)
      .values({
        tenantId: tenant.id,
        key,
        filename: cmd.filename.trim(),
        contentType: verdict.contentType,
        sizeBytes: cmd.bytes.length,
        visibility: cmd.visibility,
        storageDriver: this.storage.driver,
        storageRef: null,
      })
      .returning()
    const row = inserted[0]!

    try {
      const put = await this.storage.put(row.id, cmd.bytes, verdict.contentType)
      if (put.storageRef != null) {
        await this.dbs.db
          .update(fileObjects)
          .set({ storageRef: put.storageRef })
          .where(eq(fileObjects.id, row.id))
      }
    } catch (err) {
      // 스토리지 실패 → 레지스트리 행·카운터 롤백(고아 메타데이터 방지).
      await this.dbs.db.delete(fileObjects).where(eq(fileObjects.id, row.id))
      await this.decrementUsage(tenant.id)
      if (err instanceof StorageNotConfiguredError) {
        throw new ServiceUnavailableException(err.message)
      }
      throw err
    }

    return {
      id: row.id,
      key: row.key,
      url: this.publicUrl(publicBaseUrl, row.key),
      filename: row.filename,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      visibility: row.visibility,
    }
  }

  /** key 로 파일 메타 조회(서빙 가드용). 없으면 404. tenantId 를 주면 소유 검사. */
  async getByKey(key: string, tenantId?: string): Promise<typeof fileObjects.$inferSelect> {
    const where = tenantId
      ? and(eq(fileObjects.key, key), eq(fileObjects.tenantId, tenantId))
      : eq(fileObjects.key, key)
    const rows = await this.dbs.db.select().from(fileObjects).where(where).limit(1)
    if (!rows[0]) throw new NotFoundException(`파일 '${key}' 가 없습니다`)
    return rows[0]
  }

  /** id 로 파일 메타 조회(어드민 삭제·서명). 테넌트 범위 검사. */
  async getById(id: string, tenantId: string): Promise<typeof fileObjects.$inferSelect> {
    const rows = await this.dbs.db
      .select()
      .from(fileObjects)
      .where(and(eq(fileObjects.id, id), eq(fileObjects.tenantId, tenantId)))
      .limit(1)
    if (!rows[0]) throw new NotFoundException(`파일 '${id}' 가 없습니다`)
    return rows[0]
  }

  /** 파일 바이트 + 메타 로드(서빙). 스토리지에서 바이트가 사라졌으면 404. */
  async loadBytes(row: typeof fileObjects.$inferSelect): Promise<ServedFile> {
    let bytes: Buffer | null
    try {
      bytes = await this.storage.get(row.id, row.storageRef)
    } catch (err) {
      if (err instanceof StorageNotConfiguredError) {
        throw new ServiceUnavailableException(err.message)
      }
      throw err
    }
    if (!bytes) throw new NotFoundException('파일 바이트를 찾을 수 없습니다')
    return {
      filename: row.filename,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      bytes,
    }
  }

  /** 어드민 목록(테넌트 범위, 최신순, 페이지네이션, 가시성 필터). */
  async list(tenantId: string, query: ListFilesQuery): Promise<FileListDto> {
    const limit = clampLimit(query.limit)
    const offset = Math.max(0, Math.trunc(Number(query.offset)) || 0)
    const where = query.visibility
      ? and(eq(fileObjects.tenantId, tenantId), eq(fileObjects.visibility, query.visibility))
      : eq(fileObjects.tenantId, tenantId)

    const totalRows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(fileObjects)
      .where(where)
    const total = Number(totalRows[0]?.c ?? 0)

    const rows = await this.dbs.db
      .select()
      .from(fileObjects)
      .where(where)
      .orderBy(desc(fileObjects.createdAt))
      .offset(offset)
      .limit(limit)

    const items: FileObjectDto[] = rows.map(toFileObjectDto)
    return { items, total, offset, limit }
  }

  /** 어드민 통계 — 개수·총 바이트(+ 가시성 분해). 사용량 메트릭 files / storage_bytes. */
  async stats(tenantId: string): Promise<FileStatsDto> {
    const rows = await this.dbs.db
      .select({
        visibility: fileObjects.visibility,
        files: sql<number>`count(*)::int`,
        storageBytes: sql<number>`coalesce(sum(${fileObjects.sizeBytes}), 0)::bigint`,
      })
      .from(fileObjects)
      .where(eq(fileObjects.tenantId, tenantId))
      .groupBy(fileObjects.visibility)

    let files = 0
    let storageBytes = 0
    const byVisibility = rows.map((r) => {
      const f = Number(r.files)
      const b = Number(r.storageBytes)
      files += f
      storageBytes += b
      return { visibility: r.visibility, files: f, storageBytes: b }
    })

    const metrics: Record<UsageMetric, number> = { files, storage_bytes: storageBytes }
    return { metrics, byVisibility }
  }

  /** 어드민 삭제 — 레지스트리 + 스토리지 바이트(멱등). 카운터는 줄이지 않는다(누적 발급 카운터). */
  async delete(id: string, tenantId: string): Promise<void> {
    const row = await this.getById(id, tenantId)
    try {
      await this.storage.delete(row.id, row.storageRef)
    } catch (err) {
      if (!(err instanceof StorageNotConfiguredError)) throw err
      // 스토리지 미구성이어도 레지스트리 행은 정리한다(메타데이터 청소 우선).
    }
    await this.dbs.db.delete(fileObjects).where(eq(fileObjects.id, row.id))
  }

  /** private 파일 한시 접근용 서명 토큰 발급. HMAC(pepper) + 만료. */
  signUrl(
    row: typeof fileObjects.$inferSelect,
    publicBaseUrl: string,
    expiresInSec: number
  ): SignedUrlDto {
    const expiresAtSec = Math.floor(Date.now() / 1000) + expiresInSec
    const token = signFileToken(row.id, expiresAtSec, this.cfg.keyPepper)
    const base = this.publicUrl(publicBaseUrl, row.key)
    return {
      url: `${base}?token=${encodeURIComponent(token)}`,
      token,
      expiresAt: new Date(expiresAtSec * 1000).toISOString(),
    }
  }

  /** 서빙 URL — 절대(publicBaseUrl 있음) 또는 상대(`/api/files/:key`). */
  private publicUrl(publicBaseUrl: string, key: string): string {
    const path = `/api/files/${encodeURIComponent(key)}`
    const base = publicBaseUrl.replace(/\/+$/, '')
    return base ? `${base}${path}` : path
  }

  /** 테넌트 범위에서 유니크한 file key 를 만든다(충돌 시 재생성). */
  private async uniqueKey(tenantId: string): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = generateFileKey()
      const exists = await this.dbs.db
        .select({ id: fileObjects.id })
        .from(fileObjects)
        .where(and(eq(fileObjects.tenantId, tenantId), eq(fileObjects.key, candidate)))
        .limit(1)
      if (exists.length === 0) return candidate
    }
    // 극히 드문 충돌 — 더 긴 키로 폴백.
    return generateFileKey(40)
  }

  /** 누적 업로드 +1 후 free 캡 초과 여부(원자적 증가). */
  private async incrementUsage(
    tenantId: string,
    plan: string
  ): Promise<{ overCap: boolean; usageCount: number }> {
    const updated = await this.dbs.db
      .update(tenants)
      .set({ usageCount: sql`${tenants.usageCount} + 1` })
      .where(eq(tenants.id, tenantId))
      .returning({ usageCount: tenants.usageCount })
    const usageCount = Number(updated[0]?.usageCount ?? 0)
    const overCap = plan === 'free' && usageCount > this.cfg.freePlanFileCap
    return { overCap, usageCount }
  }

  private async decrementUsage(tenantId: string): Promise<void> {
    await this.dbs.db
      .update(tenants)
      .set({ usageCount: sql`GREATEST(${tenants.usageCount} - 1, 0)` })
      .where(eq(tenants.id, tenantId))
  }
}
