import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import {
  generateKeyPair,
  type CreateTenantInput,
  type TenantCredentialsDto,
  type TenantDto,
  type UpdateTenantInput,
} from '@notifydesk/shared'
import { eq, sql } from 'drizzle-orm'

import { hashSecret, lookupHash, verifySecret } from '../common/secret'
import { toTenantDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { tenants } from '../db/schema'

type TenantRow = typeof tenants.$inferSelect

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
  constructor(private readonly dbs: DatabaseService) {}

  /**
   * 셀프 가입 — publishable/secret 키쌍을 발급한다. secret 평문은 이 응답에서만 1회 노출.
   * slug 충돌 시 -2, -3… 으로 자동 보정. corsOrigins 미지정 시 ['*'].
   */
  async signup(input: CreateTenantInput): Promise<TenantCredentialsDto> {
    const slug = await this.uniqueSlug(input.slug ?? slugify(input.name))
    const { publishableKey, secretKey } = generateKeyPair()

    const inserted = await this.dbs.db
      .insert(tenants)
      .values({
        name: input.name,
        slug,
        plan: input.plan ?? 'free',
        publishableKey,
        secretKeyHash: hashSecret(secretKey),
        secretKeyLookup: lookupHash(secretKey),
        corsOrigins: input.corsOrigins ?? ['*'],
        usageCount: 0,
      })
      .returning()
    const row = inserted[0]!
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      publishableKey: row.publishableKey,
      secretKey, // 평문 — 1회 노출
      corsOrigins: row.corsOrigins,
      createdAt: row.createdAt.toISOString(),
    }
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
   * 룩업 해시로 후보를 찾고 scrypt verifySecret 으로 최종 확인. 없으면 null.
   */
  async findBySecretKey(key: string): Promise<TenantRow | null> {
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .where(eq(tenants.secretKeyLookup, lookupHash(key)))
      .limit(1)
    const row = rows[0]
    if (!row) return null
    return verifySecret(key, row.secretKeyHash) ? row : null
  }

  /** id 로 테넌트 조회(어드민 마스터 토큰 경로). 없으면 404. */
  async getById(id: string): Promise<TenantRow> {
    const rows = await this.dbs.db.select().from(tenants).where(eq(tenants.id, id)).limit(1)
    if (!rows[0]) throw new NotFoundException(`테넌트 '${id}' 가 없습니다`)
    return rows[0]
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
    if (input.plan != null) patch.plan = input.plan
    const updated = await this.dbs.db
      .update(tenants)
      .set(patch)
      .where(eq(tenants.id, id))
      .returning()
    return toTenantDto(updated[0]!)
  }

  /** 어드민 — 키 로테이션. 새 publishable/secret 키쌍 발급(평문 1회 노출). */
  async rotateKeys(id: string): Promise<TenantCredentialsDto> {
    await this.getById(id)
    const { publishableKey, secretKey } = generateKeyPair()
    const updated = await this.dbs.db
      .update(tenants)
      .set({
        publishableKey,
        secretKeyHash: hashSecret(secretKey),
        secretKeyLookup: lookupHash(secretKey),
      })
      .where(eq(tenants.id, id))
      .returning()
    const row = updated[0]!
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      publishableKey: row.publishableKey,
      secretKey,
      corsOrigins: row.corsOrigins,
      createdAt: row.createdAt.toISOString(),
    }
  }

  /**
   * 발송 사용량 +1 후, free 플랜 소프트 캡 초과 여부를 반환한다.
   * 원자적 증가(returning usage_count)로 동시성 안전.
   */
  async incrementUsage(id: string, plan: string, freePlanCap: number): Promise<{ overCap: boolean; usageCount: number }> {
    const updated = await this.dbs.db
      .update(tenants)
      .set({ usageCount: sql`${tenants.usageCount} + 1` })
      .where(eq(tenants.id, id))
      .returning({ usageCount: tenants.usageCount })
    const usageCount = Number(updated[0]?.usageCount ?? 0)
    const overCap = plan === 'free' && usageCount > freePlanCap
    return { overCap, usageCount }
  }

  /** 발송이 캡 초과로 거부됐을 때 카운터를 되돌린다(실제 발송 안 했으므로). */
  async decrementUsage(id: string): Promise<void> {
    await this.dbs.db
      .update(tenants)
      .set({ usageCount: sql`GREATEST(${tenants.usageCount} - 1, 0)` })
      .where(eq(tenants.id, id))
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
