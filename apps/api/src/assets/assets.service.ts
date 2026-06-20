import {
  ALLOWED_MIME_TYPES,
  buildAssetKey,
  isSafeKey,
  normalizeFolder,
  type AssetDto,
  type AssetListDto,
  type ListAssetsQuery,
} from '@mediadesk/shared'
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common'
import { and, desc, eq, sql } from 'drizzle-orm'

import { shortRandom } from '../common/keys'
import { toAssetDto } from '../common/serialize'
import { planCaps, APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { assets } from '../db/schema'
import { StorageService } from '../storage/storage.service'
import { TenantsService } from '../tenants/tenants.service'
import { TransformService, type TransformParams } from '../transform/transform.service'

import type { TenantRow } from '../common/request'

export interface UploadFile {
  buffer: Buffer
  mimetype: string
  originalname: string
  size: number
}

/** 공개 파일 서빙 결과(컨트롤러가 헤더와 함께 스트림). */
export interface ServeResult {
  body: Buffer
  contentType: string
  /** 캐시 가능한 불변 자산이면 true(원본·파생 모두 콘텐츠 주소 안정적). */
  immutable: boolean
}

const ALLOWED = new Set<string>(ALLOWED_MIME_TYPES)
const MAX_LIMIT = 200
const DEFAULT_LIMIT = 60

/** Nest 에 402 전용 예외가 없어 직접 정의(소프트 캡 — 결제 필요). */
class PaymentRequired extends HttpException {
  constructor(message: string) {
    super({ statusCode: HttpStatus.PAYMENT_REQUIRED, message }, HttpStatus.PAYMENT_REQUIRED)
  }
}

@Injectable()
export class AssetsService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly storage: StorageService,
    private readonly transform: TransformService,
    private readonly tenants: TenantsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  // ── 업로드 ────────────────────────────────────────────────────────────────────

  async upload(
    tenant: TenantRow,
    file: UploadFile | undefined,
    folderRaw: string | undefined,
    baseUrl: string
  ): Promise<AssetDto> {
    if (!file) throw new BadRequestException('업로드할 파일(file)이 없습니다')

    const mime = (file.mimetype || '').toLowerCase()
    if (!ALLOWED.has(mime)) {
      throw new BadRequestException(`허용되지 않는 파일 형식입니다: ${mime || '(unknown)'}`)
    }
    if (file.size > this.cfg.maxUploadBytes) {
      throw new PayloadTooLargeException(
        `파일이 너무 큽니다(최대 ${this.cfg.maxUploadBytes} 바이트)`
      )
    }

    // free 플랜 소프트 캡 — 누적 바이트/건수 초과 시 402.
    const caps = planCaps(this.cfg, tenant.plan)
    if (caps.maxBytes !== null && Number(tenant.usageBytes) + file.size > caps.maxBytes) {
      throw new PaymentRequired('저장 용량 한도를 초과했습니다. 플랜을 업그레이드하세요.')
    }
    if (caps.maxCount !== null && tenant.usageCount + 1 > caps.maxCount) {
      throw new PaymentRequired('자산 개수 한도를 초과했습니다. 플랜을 업그레이드하세요.')
    }

    const folder = normalizeFolder(folderRaw)
    const key = buildAssetKey({
      filename: file.originalname || 'file',
      mime,
      random: shortRandom(8),
      folder,
    })
    if (!isSafeKey(key)) throw new BadRequestException('안전하지 않은 키입니다')

    // 이미지면 치수 추출(가능하면).
    const dims = await this.transform.probeDimensions(file.buffer, mime)

    // 저장(테넌트 격리 경로) → DB row.
    const storageKey = this.storageKey(tenant.slug, key)
    await this.storage.get().put(storageKey, file.buffer, mime)

    const inserted = await this.dbs.db
      .insert(assets)
      .values({
        tenantId: tenant.id,
        key,
        folder: folder ?? null,
        contentType: mime,
        size: file.size,
        width: dims.width,
        height: dims.height,
      })
      .returning()
    const row = inserted[0]!

    await this.tenants.addUsage(tenant.id, file.size)
    return toAssetDto(baseUrl, tenant.slug, row)
  }

  // ── 목록 ─────────────────────────────────────────────────────────────────────

  async list(tenant: TenantRow, query: ListAssetsQuery, baseUrl: string): Promise<AssetListDto> {
    const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? DEFAULT_LIMIT))
    const offset = Math.max(0, query.offset ?? 0)
    const folder = normalizeFolder(query.folder)

    const where = folder
      ? and(eq(assets.tenantId, tenant.id), eq(assets.folder, folder))
      : eq(assets.tenantId, tenant.id)

    const totalRows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(assets)
      .where(where)
    const total = Number(totalRows[0]?.c ?? 0)

    const rows = await this.dbs.db
      .select()
      .from(assets)
      .where(where)
      .orderBy(desc(assets.createdAt))
      .offset(offset)
      .limit(limit)

    return { items: rows.map((r) => toAssetDto(baseUrl, tenant.slug, r)), total, offset, limit }
  }

  /** 테넌트의 폴더 목록(논리 그룹) — 대시보드 사이드바용. */
  async listFolders(tenant: TenantRow): Promise<string[]> {
    const rows = await this.dbs.db
      .selectDistinct({ folder: assets.folder })
      .from(assets)
      .where(eq(assets.tenantId, tenant.id))
    return rows
      .map((r) => r.folder)
      .filter((f): f is string => typeof f === 'string' && f.length > 0)
      .sort((a, b) => a.localeCompare(b))
  }

  // ── 삭제 ─────────────────────────────────────────────────────────────────────

  async delete(tenant: TenantRow, key: string): Promise<{ deleted: true; key: string }> {
    if (!isSafeKey(key)) throw new BadRequestException('안전하지 않은 키입니다')
    const rows = await this.dbs.db
      .select()
      .from(assets)
      .where(and(eq(assets.tenantId, tenant.id), eq(assets.key, key)))
      .limit(1)
    const row = rows[0]
    if (!row) throw new NotFoundException('자산을 찾을 수 없습니다')

    await this.storage.get().delete(this.storageKey(tenant.slug, key))
    await this.dbs.db.delete(assets).where(eq(assets.id, row.id))
    await this.tenants.subUsage(tenant.id, Number(row.size))
    return { deleted: true, key }
  }

  // ── 공개 파일 서빙(+변환) ──────────────────────────────────────────────────────

  /**
   * 공개 GET /file/:slug/:key — 원본을 읽고, 변환 파라미터가 있고 sharp 로 처리 가능하면
   * 변환본(파생 캐시)을, 아니면 원본을 반환한다(graceful original).
   */
  async serve(slug: string, key: string, params: TransformParams): Promise<ServeResult> {
    if (!isSafeKey(key)) throw new BadRequestException('안전하지 않은 키입니다')
    const tenant = await this.tenants.findBySlug(slug)
    if (!tenant) throw new NotFoundException('테넌트를 찾을 수 없습니다')

    // 메타(content-type)는 DB 가 권위 — 키만으로 추론하지 않고 등록된 자산만 서빙.
    const rows = await this.dbs.db
      .select()
      .from(assets)
      .where(and(eq(assets.tenantId, tenant.id), eq(assets.key, key)))
      .limit(1)
    const row = rows[0]
    if (!row) throw new NotFoundException('자산을 찾을 수 없습니다')

    const stored = await this.storage.get().get(this.storageKey(slug, key))
    if (!stored) throw new NotFoundException('자산 파일이 없습니다')

    const wantTransform = TransformService.hasParams(params)
    if (wantTransform) {
      const out = await this.transform.transform(
        `${tenant.id}/${key}`,
        stored.body,
        row.contentType,
        params
      )
      if (out) return { body: out.body, contentType: out.contentType, immutable: true }
      // 변환 불가(sharp 없음/비이미지) → 원본 서빙(graceful).
    }
    return { body: stored.body, contentType: row.contentType, immutable: true }
  }

  // ── 헬퍼 ─────────────────────────────────────────────────────────────────────

  /** 테넌트별 격리된 스토리지 키(<slug>/<key>). */
  private storageKey(slug: string, key: string): string {
    return `${slug}/${key}`
  }
}
