import {
  slugSchema,
  type CreateTenantInput,
  type TenantCreatedDto,
  type TenantDto,
  type UpdateTenantInput,
} from '@communitydesk/shared'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'

import {
  generatePublishableKey,
  generateSecretKey,
  hashSecretKey,
  verifySecretKey,
} from '../common/keys'
import { toTenantDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { tenants } from '../db/schema'

export type TenantRow = typeof tenants.$inferSelect

/** name → slug 후보(소문자·하이픈). 비면 'tenant'. */
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base.length > 0 ? base.slice(0, 64) : 'tenant'
}

@Injectable()
export class TenantsService {
  constructor(private readonly dbs: DatabaseService) {}

  /** 테넌트 셀프 가입 — publishable/secret 키 발급. secret 은 평문으로 1회만 반환. */
  async createTenant(input: CreateTenantInput): Promise<TenantCreatedDto> {
    const slug = await this.resolveUniqueSlug(input.slug ?? slugify(input.name))

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
        postsCount: 0,
        readsCount: 0,
      })
      .returning()
    const row = inserted[0]!
    return { tenant: toTenantDto(row), publishableKey, secretKey }
  }

  /** publishable 키로 테넌트 조회(없으면 null). */
  async findByPublishableKey(pk: string): Promise<TenantRow | null> {
    if (!pk) return null
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .where(eq(tenants.publishableKey, pk))
      .limit(1)
    return rows[0] ?? null
  }

  /** id 로 테넌트 조회(없으면 null). */
  async findById(id: string): Promise<TenantRow | null> {
    if (!id) return null
    const rows = await this.dbs.db.select().from(tenants).where(eq(tenants.id, id)).limit(1)
    return rows[0] ?? null
  }

  /**
   * secret 키로 테넌트 조회. 키 접두사로 후보를 좁힐 수 없어 전 테넌트와 타이밍 세이프 비교.
   * (테넌트 수가 많아지면 키 id 프리픽스 인덱스로 최적화 가능 — 현재는 정확성 우선.)
   */
  async findBySecretKey(sk: string): Promise<TenantRow | null> {
    if (!sk) return null
    const rows = await this.dbs.db.select().from(tenants)
    for (const row of rows) {
      if (verifySecretKey(sk, row.secretKeyHash)) return row
    }
    return null
  }

  /** 누적 글 작성 수 1 증가하고 갱신된 postsCount 반환. */
  async incrementPosts(tenantId: string): Promise<number> {
    const updated = await this.dbs.db
      .update(tenants)
      .set({ postsCount: sql`${tenants.postsCount} + 1` })
      .where(eq(tenants.id, tenantId))
      .returning({ postsCount: tenants.postsCount })
    return Number(updated[0]?.postsCount ?? 0)
  }

  /** 누적 읽기 수 1 증가(베스트 에포트 — 실패해도 읽기 자체는 막지 않는다). */
  async incrementReads(tenantId: string): Promise<void> {
    await this.dbs.db
      .update(tenants)
      .set({ readsCount: sql`${tenants.readsCount} + 1` })
      .where(eq(tenants.id, tenantId))
  }

  /** 테넌트 공개 표현. */
  async getTenant(tenantId: string): Promise<TenantDto> {
    const row = await this.findById(tenantId)
    if (!row) throw new NotFoundException('테넌트를 찾을 수 없습니다')
    return toTenantDto(row)
  }

  /** 설정 수정(부분 갱신). 키/usage 는 못 바꾼다. */
  async updateTenant(tenantId: string, input: UpdateTenantInput): Promise<TenantDto> {
    const patch: Partial<typeof tenants.$inferInsert> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.corsOrigins !== undefined) patch.corsOrigins = input.corsOrigins
    if (input.plan !== undefined) patch.plan = input.plan

    const updated = await this.dbs.db
      .update(tenants)
      .set(patch)
      .where(eq(tenants.id, tenantId))
      .returning()
    if (!updated[0]) throw new NotFoundException('테넌트를 찾을 수 없습니다')
    return toTenantDto(updated[0])
  }

  /** 키 회전 — 새 publishable/secret 발급(secret 평문 1회 반환). 기존 키는 즉시 무효. */
  async rotateKeys(tenantId: string): Promise<TenantCreatedDto> {
    const publishableKey = generatePublishableKey()
    const secretKey = generateSecretKey()
    const updated = await this.dbs.db
      .update(tenants)
      .set({ publishableKey, secretKeyHash: hashSecretKey(secretKey) })
      .where(eq(tenants.id, tenantId))
      .returning()
    if (!updated[0]) throw new NotFoundException('테넌트를 찾을 수 없습니다')
    return { tenant: toTenantDto(updated[0]), publishableKey, secretKey }
  }

  /** slug 유니크 확보 — 충돌 시 -2, -3 … 접미사. */
  private async resolveUniqueSlug(desired: string): Promise<string> {
    const parsed = slugSchema.safeParse(desired)
    const base = parsed.success ? parsed.data : slugify(desired)

    const existing = await this.dbs.db
      .select({ slug: tenants.slug })
      .from(tenants)
      .where(sql`${tenants.slug} = ${base} OR ${tenants.slug} LIKE ${base + '-%'}`)
    const taken = new Set(existing.map((r) => r.slug))
    if (!taken.has(base)) return base

    for (let i = 2; i < 1000; i += 1) {
      const candidate = `${base}-${i}`.slice(0, 64)
      if (!taken.has(candidate)) return candidate
    }
    throw new ConflictException('slug 를 생성할 수 없습니다')
  }
}
