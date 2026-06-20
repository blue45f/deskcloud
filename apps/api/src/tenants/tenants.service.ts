import {
  type CreateTenantInput,
  type Plan,
  type TenantCreatedDto,
  type TenantDto,
  type UpdateTenantInput,
} from '@addesk/shared'
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, lt, sql } from 'drizzle-orm'

import {
  generatePublishableKey,
  generateSecretKey,
  hashSecretKey,
  verifySecretKey,
} from '../common/keys'
import { toTenantDto } from '../common/serialize'
import { APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { tenants } from '../db/schema'

export type TenantRow = typeof tenants.$inferSelect

/** name 으로부터 slug 후보를 만든다(소문자·하이픈). */
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'tenant'
}

@Injectable()
export class TenantsService {
  constructor(
    private readonly dbs: DatabaseService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  /**
   * 셀프 가입 — publishable/secret 키쌍을 발급한다. secret 평문은 이 응답에서만 1회 노출.
   * slug 충돌 시 -2, -3… 으로 자동 보정. corsOrigins 미지정 시 빈 목록(서버-사이드 호출만 통과).
   */
  async signup(input: CreateTenantInput): Promise<TenantCreatedDto> {
    const slug = await this.uniqueSlug(input.slug ?? slugify(input.name))
    const publishableKey = generatePublishableKey()
    const secretKey = generateSecretKey()

    const inserted = await this.dbs.db
      .insert(tenants)
      .values({
        name: input.name,
        slug,
        plan: 'free',
        publishableKey,
        secretKeyHash: hashSecretKey(secretKey, this.cfg.keyPepper),
        corsOrigins: input.corsOrigins,
        usageCount: 0,
      })
      .returning()
    return { tenant: toTenantDto(inserted[0]!), publishableKey, secretKey }
  }

  /** publishable 키로 테넌트 조회(공개 경로 인증). 없으면 null. */
  async findByPublishableKey(key: string): Promise<TenantRow | null> {
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .where(eq(tenants.publishableKey, key))
      .limit(1)
    return rows[0] ?? null
  }

  /**
   * secret 키로 테넌트 조회(서버/어드민 경로 인증).
   * 결정적 해시로 후보를 찾고 timing-safe 비교로 최종 확인. 없으면 null.
   */
  async findBySecretKey(key: string): Promise<TenantRow | null> {
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .where(eq(tenants.secretKeyHash, hashSecretKey(key, this.cfg.keyPepper)))
      .limit(1)
    const row = rows[0]
    if (!row) return null
    return verifySecretKey(key, row.secretKeyHash, this.cfg.keyPepper) ? row : null
  }

  /** id 로 테넌트 조회(어드민 글로벌 토큰 경로). 없으면 null. */
  async findById(id: string): Promise<TenantRow | null> {
    const rows = await this.dbs.db.select().from(tenants).where(eq(tenants.id, id)).limit(1)
    return rows[0] ?? null
  }

  /** id 로 테넌트 조회 — 없으면 404(컨트롤러용). */
  async getById(id: string): Promise<TenantRow> {
    const row = await this.findById(id)
    if (!row) throw new NotFoundException(`테넌트 '${id}' 가 없습니다`)
    return row
  }

  toDto(row: TenantRow): TenantDto {
    return toTenantDto(row)
  }

  /** 어드민 — 테넌트 설정 갱신(name·corsOrigins·plan). */
  async update(id: string, input: UpdateTenantInput): Promise<TenantDto> {
    await this.getById(id)
    const patch: Partial<typeof tenants.$inferInsert> = {}
    if (input.name != null) patch.name = input.name
    if (input.corsOrigins != null) patch.corsOrigins = input.corsOrigins
    if (input.plan != null) patch.plan = input.plan as Plan
    const updated = await this.dbs.db
      .update(tenants)
      .set(patch)
      .where(eq(tenants.id, id))
      .returning()
    return toTenantDto(updated[0]!)
  }

  /** 어드민 — 키 로테이션. 새 publishable/secret 키쌍 발급(평문 1회 노출). */
  async rotateKeys(id: string): Promise<TenantCreatedDto> {
    await this.getById(id)
    const publishableKey = generatePublishableKey()
    const secretKey = generateSecretKey()
    const updated = await this.dbs.db
      .update(tenants)
      .set({ publishableKey, secretKeyHash: hashSecretKey(secretKey, this.cfg.keyPepper) })
      .where(eq(tenants.id, id))
      .returning()
    return { tenant: toTenantDto(updated[0]!), publishableKey, secretKey }
  }

  /**
   * 누적 서빙 카운터를 1 증가시키고 갱신된 값을 반환.
   * 유료 플랜(한도 없음) 서빙 직후 호출 — 단순 증가.
   */
  async incrementUsage(id: string): Promise<number> {
    const updated = await this.dbs.db
      .update(tenants)
      .set({ usageCount: sql`${tenants.usageCount} + 1` })
      .where(eq(tenants.id, id))
      .returning({ usageCount: tenants.usageCount })
    return updated[0]?.usageCount ?? 0
  }

  /**
   * 무료 플랜 한도를 원자적으로 강제하며 누적 서빙 카운터를 1 증가.
   * `UPDATE … WHERE usage_count < limit RETURNING` 단일 문이라, 한도 검사와 증가가 한 트랜잭션에서
   * 일어난다 — 동시 서빙이 같은 read-snapshot 을 보고 모두 통과하는 TOCTOU 오버슈트를 막는다.
   * @returns 증가에 성공하면 true(서빙 허용), 이미 한도라 0행이면 false(402).
   */
  async incrementUsageUnder(id: string, limit: number): Promise<boolean> {
    const updated = await this.dbs.db
      .update(tenants)
      .set({ usageCount: sql`${tenants.usageCount} + 1` })
      .where(and(eq(tenants.id, id), lt(tenants.usageCount, limit)))
      .returning({ usageCount: tenants.usageCount })
    return updated.length > 0
  }

  /** slug 충돌을 피해 유니크한 slug 를 만든다. */
  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base
    for (let n = 2; n < 1000; n += 1) {
      const exists = await this.dbs.db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, candidate))
        .limit(1)
      if (exists.length === 0) return candidate
      candidate = `${base}-${n}`
    }
    throw new ConflictException('사용 가능한 slug 를 찾지 못했습니다')
  }
}
