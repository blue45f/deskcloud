import {
  DEFAULT_MEMBER_TOKEN_TTL_SEC,
  deriveMemberTokenKey,
  generateKeyPair,
  hashSecret,
  isPublishableKey,
  isSecretKey,
  PLAN_CAPS,
  signMemberToken,
  verifyMemberToken,
  type CreateTenantInput,
  type MemberTokenDto,
  type MemberTokenPayload,
  type TenantAnalyticsDto,
  type TenantDto,
  type TenantUsage,
  type TenantWithSecretDto,
  type UpdateTenantSettingsInput,
  type VisitPingInput,
  type VisitPingResultDto,
} from '@chatdesk/shared'
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'

import { toTenantDto } from '../common/serialize'
import { APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { conversations, tenants, tenantVisits, tenantVisitUniques } from '../db/schema'

export type TenantRow = typeof tenants.$inferSelect

/**
 * 테넌트 도메인 — 가입(키 발급)·키 회전·사용량, 그리고 pk/sk 로 테넌트를 해석하는
 * 인증 헬퍼를 제공한다. pk 는 평문, sk 는 해시로만 저장(분실 시 회전).
 * 멤버 토큰(선택, 강화 인증) 발급·검증도 sk 파생 키로 수행한다.
 */
@Injectable()
export class TenantsService {
  constructor(
    private readonly dbs: DatabaseService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  /** 가입 — pk·sk 발급. corsOrigins 미지정 시 ['*'](데모). sk 평문은 응답 1회만 노출. */
  async create(input: CreateTenantInput): Promise<TenantWithSecretDto> {
    const pair = generateKeyPair()
    const corsOrigins =
      input.corsOrigins && input.corsOrigins.length > 0 ? input.corsOrigins : ['*']
    const plan = input.plan ?? 'free'

    const inserted = await this.dbs.db
      .insert(tenants)
      .values({
        name: input.name,
        publishableKey: pair.publishableKey,
        secretKeyHash: pair.secretKeyHash,
        corsOrigins,
        plan,
      })
      .returning()
    const row = inserted[0]!
    return { ...toTenantDto(row), secretKey: pair.secretKey }
  }

  /** publishable 키(pk_)로 테넌트 해석. 없거나 형태가 틀리면 null. */
  async findByPublishableKey(key: string | undefined | null): Promise<TenantRow | null> {
    if (!isPublishableKey(key)) return null
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .where(eq(tenants.publishableKey, key))
      .limit(1)
    return rows[0] ?? null
  }

  /** secret 키(sk_)로 테넌트 해석(해시 비교). 없거나 형태가 틀리면 null. */
  async findBySecretKey(key: string | undefined | null): Promise<TenantRow | null> {
    if (!isSecretKey(key)) return null
    const hash = hashSecret(key)
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .where(eq(tenants.secretKeyHash, hash))
      .limit(1)
    return rows[0] ?? null
  }

  /** id 로 테넌트 해석. */
  async findById(id: string): Promise<TenantRow | null> {
    const rows = await this.dbs.db.select().from(tenants).where(eq(tenants.id, id)).limit(1)
    return rows[0] ?? null
  }

  /**
   * Origin 이 테넌트 allowlist 를 통과하는지. `*` 가 있으면 모두 허용.
   * Origin 헤더가 없을 때(server-to-server·동일 출처)는 통과시킨다(브라우저만 Origin 을 보냄).
   */
  isOriginAllowed(tenant: Pick<TenantRow, 'corsOrigins'>, origin: string | undefined): boolean {
    const list = tenant.corsOrigins
    if (list.includes('*')) return true
    if (!origin) return true
    return list.includes(origin)
  }

  /** 키 회전 — 새 pk·sk 발급(이전 키 무효화). sk 평문은 응답 1회만 노출. */
  async rotateKeys(tenantId: string): Promise<TenantWithSecretDto> {
    const existing = await this.findById(tenantId)
    if (!existing) throw new NotFoundException('테넌트를 찾을 수 없습니다')

    const pair = generateKeyPair()
    const updated = await this.dbs.db
      .update(tenants)
      .set({ publishableKey: pair.publishableKey, secretKeyHash: pair.secretKeyHash })
      .where(eq(tenants.id, tenantId))
      .returning()
    if (!updated[0]) throw new ConflictException('키 회전에 실패했습니다')
    return { ...toTenantDto(updated[0]), secretKey: pair.secretKey }
  }

  /**
   * 테넌트 설정 수정(이름·허용 Origin·요금제). 보낸 필드만 갱신한다.
   * corsOrigins 를 빈 배열로 보내면 모든 Origin 이 막히므로 ['*'] 로 정규화한다(데모 보호).
   */
  async updateSettings(tenantId: string, input: UpdateTenantSettingsInput): Promise<TenantDto> {
    const existing = await this.findById(tenantId)
    if (!existing) throw new NotFoundException('테넌트를 찾을 수 없습니다')

    const patch: Partial<typeof tenants.$inferInsert> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.plan !== undefined) patch.plan = input.plan
    if (input.corsOrigins !== undefined) {
      patch.corsOrigins = input.corsOrigins.length > 0 ? input.corsOrigins : ['*']
    }

    const updated = await this.dbs.db
      .update(tenants)
      .set(patch)
      .where(eq(tenants.id, tenantId))
      .returning()
    if (!updated[0]) throw new ConflictException('설정 수정에 실패했습니다')
    return toTenantDto(updated[0])
  }

  /** 단건 조회(DTO). */
  async getDto(tenantId: string): Promise<TenantDto> {
    const row = await this.findById(tenantId)
    if (!row) throw new NotFoundException('테넌트를 찾을 수 없습니다')
    return toTenantDto(row)
  }

  /** 사용량(messages·cap). */
  async getUsage(tenantId: string): Promise<TenantUsage> {
    const row = await this.findById(tenantId)
    if (!row) throw new NotFoundException('테넌트를 찾을 수 없습니다')
    const caps = PLAN_CAPS[row.plan]
    return { messages: row.usageMessages, cap: { messages: caps.messages } }
  }

  /** 메시지 사용량 +n. free cap 초과 시 false(거부) — 호출자가 발송을 막는다. */
  async tryConsumeMessage(tenantId: string, n = 1): Promise<boolean> {
    const row = await this.findById(tenantId)
    if (!row) throw new UnauthorizedException('테넌트를 찾을 수 없습니다')
    const cap = PLAN_CAPS[row.plan].messages
    if (row.usageMessages + n > cap) return false
    await this.dbs.db
      .update(tenants)
      .set({ usageMessages: sql`${tenants.usageMessages} + ${n}` })
      .where(eq(tenants.id, tenantId))
    return true
  }

  // ── 방문 추적(공개 ping) ────────────────────────────────────────────────────

  /** 서버 TZ 기준 오늘 날짜(YYYY-MM-DD) — 일별 버킷 키. */
  private today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  /**
   * 공개 방문 ping 기록 — 오늘 버킷의 pageviews 를 +1 하고, visitorId 가 오늘 처음이면
   * 고유 방문자(visitors)도 +1 한다. (tenant, day, visitorId) PK + ON CONFLICT DO NOTHING
   * 으로 같은 방문자를 하루 1회만 센다. pg/PGlite 양쪽에서 동일하게 동작.
   */
  async recordVisit(tenantId: string, input: VisitPingInput): Promise<VisitPingResultDto> {
    const day = this.today()

    // 1) 오늘 버킷 보장 + pageview +1(항상). PK 충돌 시 누적.
    await this.dbs.db
      .insert(tenantVisits)
      .values({ tenantId, day, visitors: 0, pageviews: 1 })
      .onConflictDoUpdate({
        target: [tenantVisits.tenantId, tenantVisits.day],
        set: { pageviews: sql`${tenantVisits.pageviews} + 1` },
      })

    // 2) 고유 방문자 — visitorId 가 오늘 처음일 때만 visitors +1.
    if (input.visitorId) {
      const inserted = await this.dbs.db
        .insert(tenantVisitUniques)
        .values({ tenantId, day, visitorId: input.visitorId })
        .onConflictDoNothing({
          target: [
            tenantVisitUniques.tenantId,
            tenantVisitUniques.day,
            tenantVisitUniques.visitorId,
          ],
        })
        .returning({ visitorId: tenantVisitUniques.visitorId })
      if (inserted.length > 0) {
        await this.dbs.db
          .update(tenantVisits)
          .set({ visitors: sql`${tenantVisits.visitors} + 1` })
          .where(and(eq(tenantVisits.tenantId, tenantId), eq(tenantVisits.day, day)))
      }
    }

    const row = await this.dbs.db
      .select({ visitors: tenantVisits.visitors, pageviews: tenantVisits.pageviews })
      .from(tenantVisits)
      .where(and(eq(tenantVisits.tenantId, tenantId), eq(tenantVisits.day, day)))
      .limit(1)
    return {
      todayVisitors: row[0]?.visitors ?? 0,
      todayPageviews: row[0]?.pageviews ?? 0,
    }
  }

  /**
   * 어드민 분석 — 트래픽(추적값)과 가입(실측)을 테넌트 범위로 집계한다.
   *
   * - 트래픽: tenant_visits 의 오늘 행(todayVisitors) + 전체 pageviews 합(totalTraffic).
   * - 가입: conversations.member_ids(jsonb) 에서 distinct 멤버를 first-seen(대화 MIN created_at)
   *   으로 도출한다. today = first-seen 이 오늘 0시 이후인 멤버 수, total = distinct 멤버 수.
   *   member_ids 가 jsonb 배열이라 pg/PGlite 공통으로 동작하도록 후보 대화를 가져와 앱에서
   *   집계한다(테넌트당 대화 수가 데모 규모라 충분).
   */
  async getAnalytics(tenantId: string): Promise<TenantAnalyticsDto> {
    const day = this.today()

    // 트래픽 — 오늘 버킷 + 누적 pageview 합.
    const todayRow = await this.dbs.db
      .select({ visitors: tenantVisits.visitors })
      .from(tenantVisits)
      .where(and(eq(tenantVisits.tenantId, tenantId), eq(tenantVisits.day, day)))
      .limit(1)
    const totalRow = await this.dbs.db
      .select({ total: sql<number>`coalesce(sum(${tenantVisits.pageviews}), 0)::int` })
      .from(tenantVisits)
      .where(eq(tenantVisits.tenantId, tenantId))

    // 가입 — distinct 멤버의 first-seen(대화 created_at) 으로 today/total.
    const convs = await this.dbs.db
      .select({ memberIds: conversations.memberIds, createdAt: conversations.createdAt })
      .from(conversations)
      .where(eq(conversations.tenantId, tenantId))
    const firstSeen = new Map<string, number>()
    for (const c of convs) {
      const ts = new Date(c.createdAt).getTime()
      for (const m of c.memberIds) {
        const prev = firstSeen.get(m)
        if (prev === undefined || ts < prev) firstSeen.set(m, ts)
      }
    }
    const startOfToday = new Date(`${day}T00:00:00.000Z`).getTime()
    let todaySignups = 0
    for (const ts of firstSeen.values()) {
      if (ts >= startOfToday) todaySignups += 1
    }

    return {
      todayVisitors: todayRow[0]?.visitors ?? 0,
      totalTraffic: totalRow[0]?.total ?? 0,
      todaySignups,
      totalSignups: firstSeen.size,
    }
  }

  // ── 멤버 토큰(선택, 강화 인증) ──────────────────────────────────────────────

  /** 테넌트의 멤버 토큰 서명 키(명시 시크릿 우선, 없으면 sk 해시 파생). */
  private signingKey(tenant: TenantRow): string {
    return deriveMemberTokenKey(tenant.secretKeyHash, this.cfg.memberTokenSecret)
  }

  /** 호스트 서버(sk)가 멤버 토큰을 발급한다. pk·sub·만료를 서명. */
  issueMemberToken(
    tenant: TenantRow,
    memberId: string,
    ttlSec = DEFAULT_MEMBER_TOKEN_TTL_SEC
  ): MemberTokenDto {
    const exp = Math.floor(Date.now() / 1000) + ttlSec
    const token = signMemberToken(
      { pk: tenant.publishableKey, sub: memberId, exp },
      this.signingKey(tenant)
    )
    return { memberId, token, expiresAt: new Date(exp * 1000).toISOString() }
  }

  /** 멤버 토큰 검증 — 테넌트 서명 키로 확인하고 pk 가 테넌트와 일치하는지 교차 확인. */
  verifyMemberToken(tenant: TenantRow, token: string | undefined): MemberTokenPayload | null {
    const payload = verifyMemberToken(token, this.signingKey(tenant))
    if (!payload) return null
    if (payload.pk !== tenant.publishableKey) return null
    return payload
  }
}
