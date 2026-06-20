import {
  generatePublishableKey,
  generateSecretKey,
  hashSecretKey,
  slugify,
  type CreateTenantInput,
  type TenantDto,
  type TenantWithKeysDto,
  type UpdateTenantInput,
} from '@changelogdesk/shared'
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'

import { toTenantDto } from '../common/serialize'
import { APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { tenants } from '../db/schema'

import type { TenantRow } from './tenant-context.service'

@Injectable()
export class TenantsService {
  constructor(
    private readonly dbs: DatabaseService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  private dto(row: TenantRow): TenantDto {
    return toTenantDto(row, { monthlyLimit: this.cfg.freeMonthlyLimit })
  }

  /** name → 충돌 없는 유니크 slug 파생(이미 있으면 -2, -3 … 접미사). */
  private async uniqueSlug(desired: string): Promise<string> {
    const base = slugify(desired)
    let candidate = base
    for (let i = 2; i < 1000; i += 1) {
      const exists = await this.dbs.db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, candidate))
        .limit(1)
      if (exists.length === 0) return candidate
      candidate = `${base}-${i}`
    }
    throw new ConflictException('사용 가능한 slug 를 찾지 못했습니다')
  }

  /**
   * 외부 온보딩 진입점 — 셀프서브 가입.
   * pk/sk 를 발급하고 sk 해시만 저장, 평문 sk 는 이 응답에서만 1회 반환.
   */
  async signup(input: CreateTenantInput): Promise<TenantWithKeysDto> {
    const slug = await this.uniqueSlug(input.slug ?? input.name)
    const publishableKey = generatePublishableKey()
    const secretKey = generateSecretKey()

    const inserted = await this.dbs.db
      .insert(tenants)
      .values({
        name: input.name,
        slug,
        publishableKey,
        secretKeyHash: hashSecretKey(secretKey),
        corsOrigins: input.corsOrigins ?? [],
        plan: 'free',
      })
      .returning()
    const row = inserted[0]!

    return { tenant: this.dto(row), publishableKey, secretKey }
  }

  /** 어드민 — 테넌트 설정·키·사용량 조회. */
  async get(tenantId: string): Promise<TenantDto> {
    return this.dto(await this.requireById(tenantId))
  }

  /** 어드민 — cors/plan 변경. */
  async update(tenantId: string, input: UpdateTenantInput): Promise<TenantDto> {
    await this.requireById(tenantId)
    const patch: Partial<typeof tenants.$inferInsert> = {}
    if (input.corsOrigins !== undefined) patch.corsOrigins = input.corsOrigins
    if (input.plan !== undefined) patch.plan = input.plan
    const updated = await this.dbs.db
      .update(tenants)
      .set(patch)
      .where(eq(tenants.id, tenantId))
      .returning()
    return this.dto(updated[0]!)
  }

  /**
   * 어드민 — 키 회전. 새 pk/sk 를 발급하고 기존 키를 무효화한다.
   * 평문 sk 는 이 응답에서만 1회 반환.
   */
  async rotateKeys(tenantId: string): Promise<TenantWithKeysDto> {
    await this.requireById(tenantId)
    const publishableKey = generatePublishableKey()
    const secretKey = generateSecretKey()
    const updated = await this.dbs.db
      .update(tenants)
      .set({ publishableKey, secretKeyHash: hashSecretKey(secretKey) })
      .where(eq(tenants.id, tenantId))
      .returning()
    const row = updated[0]!
    return { tenant: this.dto(row), publishableKey, secretKey }
  }

  /** 공개 위젯 호출마다 사용량 +1(소프트 한도 측정). */
  async incrementUsage(tenantId: string): Promise<void> {
    await this.dbs.db
      .update(tenants)
      .set({ usageCount: sql`${tenants.usageCount} + 1` })
      .where(eq(tenants.id, tenantId))
  }

  private async requireById(tenantId: string): Promise<TenantRow> {
    const rows = await this.dbs.db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
    if (!rows[0]) throw new NotFoundException('테넌트를 찾을 수 없습니다')
    return rows[0]
  }
}
