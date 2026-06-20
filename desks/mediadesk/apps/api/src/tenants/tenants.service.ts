import {
  isValidSlug,
  slugify,
  type Plan,
  type RotateKeysResultDto,
  type SignupInput,
  type SignupResultDto,
  type TenantDto,
  type UpdateTenantInput,
} from '@mediadesk/shared'
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'

import {
  generatePublishableKey,
  generateSecretKey,
  hashSecretKey,
  shortRandom,
} from '../common/keys'
import { toTenantDto } from '../common/serialize'
import { APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { tenants } from '../db/schema'

type TenantRow = typeof tenants.$inferSelect

@Injectable()
export class TenantsService {
  constructor(
    private readonly dbs: DatabaseService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  // ── 조회 ────────────────────────────────────────────────────────────────────

  /** publishable 키 → 테넌트 row(공개 엔드포인트 인증). 없으면 null. */
  async findByPublishableKey(pk: string): Promise<TenantRow | null> {
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .where(eq(tenants.publishableKey, pk))
      .limit(1)
    return rows[0] ?? null
  }

  /** secret 키 해시 → 테넌트 row(어드민 인증). 없으면 null. */
  async findBySecretKey(sk: string): Promise<TenantRow | null> {
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .where(eq(tenants.secretKeyHash, hashSecretKey(sk)))
      .limit(1)
    return rows[0] ?? null
  }

  /** slug → 테넌트 row(공개 파일 서빙 경로). 없으면 null. */
  async findBySlug(slug: string): Promise<TenantRow | null> {
    const rows = await this.dbs.db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1)
    return rows[0] ?? null
  }

  /** id → 테넌트 row. */
  async findById(id: string): Promise<TenantRow | null> {
    const rows = await this.dbs.db.select().from(tenants).where(eq(tenants.id, id)).limit(1)
    return rows[0] ?? null
  }

  /** 어드민: 모든 테넌트(생성 최신순) — ADMIN_TOKEN 마스터가 본다. */
  async listTenants(): Promise<TenantDto[]> {
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .orderBy(sql`${tenants.createdAt} desc`)
    return rows.map((r) => toTenantDto(this.cfg, r))
  }

  /**
   * 가입 집계(실데이터) — total=전체 테넌트 수, today=오늘(서버 TZ) 신규.
   * 운영 overview 의 "총 가입 수 / 오늘 신규 가입자 수" 단일 소스.
   */
  async signupStats(): Promise<{ total: number; today: number }> {
    const rows = (await this.dbs.db.execute(sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today
      FROM tenants
    `)) as unknown as { rows?: { total: number | string; today: number | string }[] }
    const row = (rows.rows ?? (rows as unknown as { total: number; today: number }[]))[0]
    return { total: Number(row?.total ?? 0), today: Number(row?.today ?? 0) }
  }

  // ── 가입(self-register) ──────────────────────────────────────────────────────

  /**
   * 테넌트 가입 — publishable/secret 키 발급. secret 평문은 응답에서만 1회 노출되고
   * DB 에는 해시만 저장한다. slug 충돌 시 짧은 무작위 접미사로 유일성 보장.
   */
  async signup(input: SignupInput): Promise<SignupResultDto> {
    const slug = await this.resolveSlug(input.slug ?? slugify(input.name))
    const plan: Plan = input.plan ?? 'free'
    const publishableKey = generatePublishableKey()
    const secretKey = generateSecretKey()

    const inserted = await this.dbs.db
      .insert(tenants)
      .values({
        slug,
        name: input.name,
        plan,
        publishableKey,
        secretKeyHash: hashSecretKey(secretKey),
        corsOrigins: input.corsOrigins ?? [],
        storageDriver: this.cfg.storageDriver,
      })
      .returning()
    const row = inserted[0]!
    return { tenant: toTenantDto(this.cfg, row), secretKey }
  }

  /** slug 유일성 확보 — 충돌하면 -<rand> 접미. */
  private async resolveSlug(desired: string): Promise<string> {
    let base = desired && isValidSlug(desired) ? desired : slugify(desired) || `t-${shortRandom(6)}`
    base = base.slice(0, 56) // 접미 여유
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${shortRandom(5)}`
      const existing = await this.findBySlug(candidate)
      if (!existing) return candidate
    }
    return `${base}-${shortRandom(8)}`
  }

  // ── 어드민: 설정·키 ──────────────────────────────────────────────────────────

  /** 테넌트 설정 변경(이름·플랜·CORS). */
  async updateTenant(id: string, input: UpdateTenantInput): Promise<TenantDto> {
    await this.requireTenant(id)
    const patch: Partial<TenantRow> = { updatedAt: new Date() }
    if (input.name !== undefined) patch.name = input.name
    if (input.plan !== undefined) patch.plan = input.plan
    if (input.corsOrigins !== undefined) patch.corsOrigins = input.corsOrigins
    const updated = await this.dbs.db
      .update(tenants)
      .set(patch)
      .where(eq(tenants.id, id))
      .returning()
    return toTenantDto(this.cfg, updated[0]!)
  }

  /** 키 회전 — 새 pk/sk 발급(이전 키 즉시 무효). 새 secret 평문 1회 노출. */
  async rotateKeys(id: string): Promise<RotateKeysResultDto> {
    await this.requireTenant(id)
    const publishableKey = generatePublishableKey()
    const secretKey = generateSecretKey()
    await this.dbs.db
      .update(tenants)
      .set({
        publishableKey,
        secretKeyHash: hashSecretKey(secretKey),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
    return { publishableKey, secretKey }
  }

  // ── 사용량 회계 ───────────────────────────────────────────────────────────────

  /** 업로드 반영(증분). */
  async addUsage(id: string, bytes: number): Promise<void> {
    await this.dbs.db
      .update(tenants)
      .set({
        usageBytes: sql`${tenants.usageBytes} + ${bytes}`,
        usageCount: sql`${tenants.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
  }

  /** 삭제 반영(증분, 0 미만 방지). */
  async subUsage(id: string, bytes: number): Promise<void> {
    await this.dbs.db
      .update(tenants)
      .set({
        usageBytes: sql`greatest(0, ${tenants.usageBytes} - ${bytes})`,
        usageCount: sql`greatest(0, ${tenants.usageCount} - 1)`,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
  }

  private async requireTenant(id: string): Promise<TenantRow> {
    const row = await this.findById(id)
    if (!row) throw new NotFoundException('테넌트를 찾을 수 없습니다')
    return row
  }

  /** 어드민 토큰(마스터)로 단일 테넌트가 없을 때, 기본 대상 테넌트를 보장(편의). */
  async ensureSingleTenant(): Promise<TenantRow> {
    const rows = await this.dbs.db.select().from(tenants).limit(1)
    if (rows[0]) return rows[0]
    throw new ConflictException('관리할 테넌트가 없습니다. 먼저 가입하세요.')
  }
}
