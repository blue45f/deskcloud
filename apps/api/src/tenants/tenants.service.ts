import {
  generatePublishableKey,
  generateSecretKey,
  hashSecretKey,
  type CreateTenantInput,
  type TenantWithSecretDto,
  type UpdateTenantInput,
  type UsageMetric,
} from '@authdesk/shared'
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'

import { APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { isUniqueViolation } from '../db/db-errors'
import { tenants, usageCounters } from '../db/schema'

import { toTenantDto, type TenantRecord } from './tenant.types'

type Row = typeof tenants.$inferSelect

function toRecord(row: Row): TenantRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    publishableKey: row.publishableKey,
    secretKeyHash: row.secretKeyHash,
    corsOrigins: row.corsOrigins,
    plan: row.plan,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * 테넌트(앱) 라이프사이클 — 가입(키 발급)·조회·secret 인증·수정·키 회전.
 *
 * publishable 키는 평문 저장(공개 안전), secret 키는 SHA-256(키 + pepper) 해시만 저장한다.
 * secret 평문은 가입/회전 응답에서 **1회만** 반환한다(이후 재노출 불가).
 */
@Injectable()
export class TenantsService {
  constructor(
    private readonly dbs: DatabaseService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  /**
   * 가입 — pk_/sk_ 발급. slug 중복은 409. secret 평문은 응답에서만.
   *
   * 사전 SELECT 는 동시 동일 slug 가입에서 경합에 질 수 있으므로, 유니크 제약 위반(23505)도
   * 409 로 매핑한다(slug/pk/secret 해시 유니크가 무결성을 지키며 일반 500 으로 새지 않게).
   */
  async signup(input: CreateTenantInput): Promise<TenantWithSecretDto> {
    const dupe = await this.dbs.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, input.slug))
      .limit(1)
    if (dupe[0]) throw new ConflictException(`slug '${input.slug}' 은 이미 사용 중입니다`)

    const publishableKey = generatePublishableKey()
    const secretKey = generateSecretKey()
    const secretKeyHash = hashSecretKey(secretKey, this.cfg.keyPepper)

    try {
      const inserted = await this.dbs.db
        .insert(tenants)
        .values({
          name: input.name,
          slug: input.slug,
          publishableKey,
          secretKeyHash,
          corsOrigins: input.corsOrigins,
          plan: input.plan,
        })
        .returning()
      const rec = toRecord(inserted[0]!)
      return { ...toTenantDto(rec), secretKey }
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`slug '${input.slug}' 은 이미 사용 중입니다`)
      }
      throw err
    }
  }

  /** publishable 키로 테넌트 해석(공개 위젯 경로). 없으면 null. */
  async findByPublishableKey(key: string): Promise<TenantRecord | null> {
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .where(eq(tenants.publishableKey, key))
      .limit(1)
    return rows[0] ? toRecord(rows[0]) : null
  }

  /** secret 키 해시 매칭으로 테넌트 인증(어드민/서버-서버 경로). 없으면 null. */
  async authenticateBySecretKey(secretKey: string): Promise<TenantRecord | null> {
    const hash = hashSecretKey(secretKey, this.cfg.keyPepper)
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .where(eq(tenants.secretKeyHash, hash))
      .limit(1)
    return rows[0] ? toRecord(rows[0]) : null
  }

  async findById(id: string): Promise<TenantRecord> {
    const rows = await this.dbs.db.select().from(tenants).where(eq(tenants.id, id)).limit(1)
    if (!rows[0]) throw new NotFoundException('테넌트를 찾을 수 없습니다')
    return toRecord(rows[0])
  }

  /** 테넌트 수정(name·corsOrigins). */
  async update(id: string, patch: UpdateTenantInput): Promise<TenantRecord> {
    const updated = await this.dbs.db
      .update(tenants)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.corsOrigins !== undefined ? { corsOrigins: patch.corsOrigins } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning()
    if (!updated[0]) throw new NotFoundException('테넌트를 찾을 수 없습니다')
    return toRecord(updated[0])
  }

  /** 키 회전 — 새 secret 키 발급 + 해시 교체. 이전 키 즉시 무효. */
  async rotateKeys(id: string): Promise<TenantWithSecretDto> {
    const secretKey = generateSecretKey()
    const secretKeyHash = hashSecretKey(secretKey, this.cfg.keyPepper)
    const updated = await this.dbs.db
      .update(tenants)
      .set({ secretKeyHash, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning()
    if (!updated[0]) throw new NotFoundException('테넌트를 찾을 수 없습니다')
    return { ...toTenantDto(toRecord(updated[0])), secretKey }
  }

  // ── 사용량 미터링 ──────────────────────────────────────────────────────────

  /** 메트릭 누적값을 delta 만큼 증가(없으면 생성). */
  async incrementUsage(tenantId: string, metric: UsageMetric, delta = 1): Promise<void> {
    // upsert: (tenant, metric) 유니크. PGlite·pg 양쪽 동일한 ON CONFLICT 경로.
    await this.dbs.db
      .insert(usageCounters)
      .values({ tenantId, metric, count: delta })
      .onConflictDoUpdate({
        target: [usageCounters.tenantId, usageCounters.metric],
        set: { count: sql`${usageCounters.count} + ${delta}`, updatedAt: new Date() },
      })
  }

  /** 메트릭 누적값 조회(없으면 0). */
  async getUsage(tenantId: string, metric: UsageMetric): Promise<number> {
    const rows = await this.dbs.db
      .select({ count: usageCounters.count })
      .from(usageCounters)
      .where(sql`${usageCounters.tenantId} = ${tenantId} and ${usageCounters.metric} = ${metric}`)
      .limit(1)
    return Number(rows[0]?.count ?? 0)
  }
}
