import { createHash } from 'node:crypto'

import {
  buildUsageSummary,
  hashPassword,
  isAtLimit,
  normalizeEmail,
  planUserLimit,
  verifyPassword,
  type AuthResultDto,
  type AuthStatsDto,
  type EndUserDto,
  type LoginInput,
  type Plan,
  type RegisterInput,
  type TrackVisitResultDto,
  type UsageSummaryDto,
  type UserListDto,
  type UserListQuery,
} from '@authdesk/shared'
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { and, count, desc, eq, gte, ilike, isNull, min, sql, sum } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { isUniqueViolation } from '../db/db-errors'
import { endUsers, sessions, trafficDaily, visitorSeen } from '../db/schema'
import { TenantsService } from '../tenants/tenants.service'

import { toEndUserDto, type EndUserContext, type EndUserRecord } from './end-user.types'
import { TokenService } from './token.service'

import type { TenantRecord } from '../tenants/tenant.types'

type Row = typeof endUsers.$inferSelect

function toRecord(row: Row): EndUserRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    passwordHash: row.passwordHash,
    name: row.name,
    verified: row.verified,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * 오늘의 자정 경계(앱 서버 tz). 가입-오늘·방문-오늘을 한곳에서 동일하게 결정한다.
 * 운영자 기대(서버 로컬 자정)에 맞춰 setHours(0,0,0,0) 로 계산한다.
 */
function startOfToday(now = new Date()): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

/** 날짜 버킷 키(YYYY-MM-DD, 서버 tz). traffic_daily.day / visitor_seen.day 와 동일 경계. */
function dayKey(now = new Date()): string {
  const d = startOfToday(now)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * end-user 인증 도메인 — 테넌트 풀의 최종 사용자 가입·로그인·세션·통계.
 *
 * 비밀번호는 scrypt(@authdesk/shared)로 해시해 저장하고 평문은 절대 보관/로그하지 않는다.
 * 세션은 JWT(테넌트별 서명) + sessions 테이블의 jti 추적(로그아웃 시 revoke)으로 관리한다.
 * 테넌트(앱) 키(pk_/sk_)와 혼동하지 말 것 — 여기는 그 테넌트가 소유한 사용자 풀이다.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly tokens: TokenService,
    private readonly tenants: TenantsService
  ) {}

  /**
   * 가입 — (tenantId, email) 유니크. 이미 있으면 409. 성공 시 사용자·토큰·세션을 만든다.
   * 반환 토큰으로 즉시 로그인 상태가 된다.
   *
   * 플랜 한도(`PLAN_USER_LIMITS`)를 라이브 count 로 강제한다(-1=무제한). 가득 차면 403 으로 거절.
   * 동시 중복 가입은 사전 SELECT 가 경합에 질 수 있어, 유니크 제약 위반(23505)도 409 로 매핑한다.
   */
  async register(tenant: TenantRecord, input: RegisterInput): Promise<AuthResultDto> {
    const email = normalizeEmail(input.email)

    // 플랜 한도 강제 — auth_users 는 end_users 라이브 count 가 권위 소스(스냅샷 카운터 드리프트 없음).
    const limit = planUserLimit(tenant.plan)
    const used = await this.countUsers(tenant.id)
    if (isAtLimit(used, limit)) {
      throw new ForbiddenException(
        `'${tenant.plan}' 플랜의 사용자 한도(${limit})에 도달했습니다. 플랜을 업그레이드하세요.`
      )
    }

    const dupe = await this.dbs.db
      .select({ id: endUsers.id })
      .from(endUsers)
      .where(and(eq(endUsers.tenantId, tenant.id), eq(endUsers.email, email)))
      .limit(1)
    if (dupe[0]) throw new ConflictException('이미 가입된 이메일입니다')

    const passwordHash = await hashPassword(input.password)
    let user: EndUserRecord
    try {
      const inserted = await this.dbs.db
        .insert(endUsers)
        .values({ tenantId: tenant.id, email, passwordHash, name: input.name.trim() })
        .returning()
      user = toRecord(inserted[0]!)
    } catch (err) {
      // 사전 SELECT 를 통과한 동시 요청이 같은 (tenantId, email) 로 INSERT 경합에 진 경우.
      // 유니크 제약(end_users_tenant_email_uq)이 무결성을 지키며, 일반 500 대신 409 로 매핑한다.
      if (isUniqueViolation(err)) throw new ConflictException('이미 가입된 이메일입니다')
      throw err
    }

    return this.issueSession(user)
  }

  /**
   * 로그인 — 이메일로 사용자를 찾고 scrypt 검증. 실패는 사용자 존재 여부를 노출하지 않도록
   * 동일한 401 로 응답한다. 성공 시 lastLoginAt 갱신 + logins 사용량 +1, 새 세션 발급.
   */
  async login(tenant: TenantRecord, input: LoginInput): Promise<AuthResultDto> {
    const email = normalizeEmail(input.email)
    const rows = await this.dbs.db
      .select()
      .from(endUsers)
      .where(and(eq(endUsers.tenantId, tenant.id), eq(endUsers.email, email)))
      .limit(1)
    const user = rows[0] ? toRecord(rows[0]) : null

    // 사용자 부재든 비번 불일치든 동일 메시지/지연(아이디 열거 방지). 부재 시에도 검증을 흉내내지 않고
    // 곧장 실패시키되, 메시지는 동일하게 둔다.
    const ok = user ? await verifyPassword(input.password, user.passwordHash) : false
    if (!user || !ok) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다')

    await this.dbs.db
      .update(endUsers)
      .set({ lastLoginAt: new Date() })
      .where(eq(endUsers.id, user.id))
    await this.tenants.incrementUsage(tenant.id, 'logins', 1)
    return this.issueSession(user)
  }

  /** /auth/me — 인증된 end-user 의 공개 DTO. 사용자가 삭제됐으면 401. */
  async me(ctx: EndUserContext): Promise<EndUserDto> {
    const rows = await this.dbs.db
      .select()
      .from(endUsers)
      .where(and(eq(endUsers.id, ctx.userId), eq(endUsers.tenantId, ctx.tenantId)))
      .limit(1)
    if (!rows[0]) throw new UnauthorizedException('세션이 더 이상 유효하지 않습니다')
    return toEndUserDto(toRecord(rows[0]))
  }

  /** 로그아웃 — 세션(jti)을 revoke 한다. 멱등(이미 폐기/부재여도 ok). */
  async logout(ctx: EndUserContext): Promise<void> {
    await this.dbs.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, ctx.sessionId), isNull(sessions.revokedAt)))
  }

  /**
   * 토큰 검증 → 인증 컨텍스트. JWT 서명·만료 검증(TokenService) 후 sessions 에서 jti 가
   * 살아있는지(미revoke·미만료) 확인한다. 어느 단계든 실패하면 null(가드가 401 처리).
   */
  async authenticate(token: string): Promise<EndUserContext | null> {
    const claims = await this.tokens.verify(token)
    if (!claims) return null

    const rows = await this.dbs.db
      .select({ id: sessions.id, expiresAt: sessions.expiresAt, revokedAt: sessions.revokedAt })
      .from(sessions)
      .where(eq(sessions.id, claims.jti))
      .limit(1)
    const session = rows[0]
    if (!session || session.revokedAt) return null
    if (session.expiresAt.getTime() <= Date.now()) return null

    return { sessionId: claims.jti, userId: claims.sub, tenantId: claims.tid }
  }

  // ── 어드민(secret 키) ───────────────────────────────────────────────────────

  /** 사용자 목록(페이지네이션 + 이메일 부분검색). 테넌트 범위로 격리. */
  async listUsers(tenantId: string, query: UserListQuery): Promise<UserListDto> {
    const filters = [eq(endUsers.tenantId, tenantId)]
    if (query.q) filters.push(ilike(endUsers.email, `%${query.q}%`))
    const where = and(...filters)

    const totalRows = await this.dbs.db.select({ c: count() }).from(endUsers).where(where)
    const total = Number(totalRows[0]?.c ?? 0)

    const rows = await this.dbs.db
      .select()
      .from(endUsers)
      .where(where)
      .orderBy(desc(endUsers.createdAt))
      .limit(query.limit)
      .offset(query.offset)

    return {
      items: rows.map((r) => toEndUserDto(toRecord(r))),
      total,
      offset: query.offset,
      limit: query.limit,
    }
  }

  /** 사용자 삭제 — 세션도 함께 폐기(블랙리스트). 테넌트 범위 밖이면 404. */
  async deleteUser(tenantId: string, userId: string): Promise<void> {
    const deleted = await this.dbs.db
      .delete(endUsers)
      .where(and(eq(endUsers.id, userId), eq(endUsers.tenantId, tenantId)))
      .returning({ id: endUsers.id })
    if (!deleted[0]) throw new NotFoundException('사용자를 찾을 수 없습니다')

    // auth_users 는 라이브 count 로 파생하므로 별도 카운터 감소가 필요 없다(드리프트 방지).
    await this.dbs.db.delete(sessions).where(eq(sessions.userId, userId))
  }

  /** 테넌트 풀의 현재 end-user 수(라이브 count) — auth_users 메트릭의 권위 소스. */
  async countUsers(tenantId: string): Promise<number> {
    const rows = await this.dbs.db
      .select({ c: count() })
      .from(endUsers)
      .where(eq(endUsers.tenantId, tenantId))
    return Number(rows[0]?.c ?? 0)
  }

  /**
   * 사용량 요약 — 메트릭별 used/limit/remaining(GET /auth/usage). 운영자가 플랜 한도 대비
   * 여유를 본다. auth_users 는 라이브 count, logins 는 누적 카운터에서 읽는다.
   */
  async usage(tenantId: string, plan: Plan): Promise<UsageSummaryDto> {
    const [authUsers, logins] = await Promise.all([
      this.countUsers(tenantId),
      this.tenants.getUsage(tenantId, 'logins'),
    ])
    return buildUsageSummary(tenantId, plan, { auth_users: authUsers, logins })
  }

  /**
   * 통계 — 사용자 수·오늘/최근 가입·누적 로그인·verified·트래픽.
   *
   * 가입 통계는 end_users.createdAt 의 실제 데이터(백필 없음). 트래픽은 신규-추적이라
   * '추적 시작(since) 이후'만 누적된다. 모든 메트릭은 로그인 테넌트 범위로 격리.
   */
  async stats(tenantId: string, plan: Plan): Promise<AuthStatsDto> {
    const now = Date.now()
    const since7 = new Date(now - 7 * MS_PER_DAY)
    const since30 = new Date(now - 30 * MS_PER_DAY)
    const today = startOfToday()
    const todayKey = dayKey()

    const [userCount, verifiedRow, todayRow, last7Row, last30Row, logins, traffic] =
      await Promise.all([
        this.countUsers(tenantId),
        this.dbs.db
          .select({ c: count() })
          .from(endUsers)
          .where(and(eq(endUsers.tenantId, tenantId), eq(endUsers.verified, true))),
        this.dbs.db
          .select({ c: count() })
          .from(endUsers)
          .where(and(eq(endUsers.tenantId, tenantId), gte(endUsers.createdAt, today))),
        this.dbs.db
          .select({ c: count() })
          .from(endUsers)
          .where(and(eq(endUsers.tenantId, tenantId), gte(endUsers.createdAt, since7))),
        this.dbs.db
          .select({ c: count() })
          .from(endUsers)
          .where(and(eq(endUsers.tenantId, tenantId), gte(endUsers.createdAt, since30))),
        this.tenants.getUsage(tenantId, 'logins'),
        this.trafficStats(tenantId, todayKey),
      ])

    return {
      userCount,
      todaySignups: Number(todayRow[0]?.c ?? 0),
      signups: { last7d: Number(last7Row[0]?.c ?? 0), last30d: Number(last30Row[0]?.c ?? 0) },
      logins,
      verified: Number(verifiedRow[0]?.c ?? 0),
      traffic,
      plan,
    }
  }

  /**
   * 트래픽 집계 — 총 방문(sum visits)·오늘 방문/고유 방문자·추적 시작일(min day).
   * 추적 데이터가 없으면 0/null 로 정직하게 반환(백필 없음).
   */
  private async trafficStats(tenantId: string, todayKey: string): Promise<AuthStatsDto['traffic']> {
    const [aggRow, todayRow] = await Promise.all([
      this.dbs.db
        .select({ total: sum(trafficDaily.visits), since: min(trafficDaily.day) })
        .from(trafficDaily)
        .where(eq(trafficDaily.tenantId, tenantId)),
      this.dbs.db
        .select({ visits: trafficDaily.visits, uniques: trafficDaily.uniques })
        .from(trafficDaily)
        .where(and(eq(trafficDaily.tenantId, tenantId), eq(trafficDaily.day, todayKey)))
        .limit(1),
    ])

    return {
      today: Number(todayRow[0]?.visits ?? 0),
      total: Number(aggRow[0]?.total ?? 0),
      todayVisitors: Number(todayRow[0]?.uniques ?? 0),
      since: aggRow[0]?.since ?? null,
    }
  }

  /**
   * 방문 핑 집계 — 위젯/대시보드가 publishable 키로 쏘는 공개 핑(POST /auth/visit).
   *
   * traffic_daily(tenantId, 오늘) 의 visits 를 +1 한다(upsert). 고유 방문자는 정직하게 근사한다:
   * SHA-256(pk + day + vid|ip) 해시를 visitor_seen 에 ON CONFLICT DO NOTHING 으로 넣고,
   * 새로 삽입됐을 때만(=그날 첫 방문) uniques 를 +1 한다. vid 원문/ip 는 저장하지 않는다.
   */
  async trackVisit(
    tenant: TenantRecord,
    vid: string | undefined,
    ip: string | undefined
  ): Promise<TrackVisitResultDto> {
    const day = dayKey()
    // vid 가 있으면 방문자별, 없으면 IP 로 폴백(둘 다 없으면 'anon' — 같은 날 1회만 unique).
    const seed = vid ?? ip ?? 'anon'
    const vidHash = createHash('sha256')
      .update(`${tenant.publishableKey}|${day}|${seed}`)
      .digest('hex')

    // 오늘 첫 방문(unique)인지: seen-set 에 삽입을 시도하고 삽입된 행 수로 판정(멱등·동시성 안전).
    const seen = await this.dbs.db
      .insert(visitorSeen)
      .values({ tenantId: tenant.id, day, vidHash })
      .onConflictDoNothing({ target: [visitorSeen.tenantId, visitorSeen.day, visitorSeen.vidHash] })
      .returning({ id: visitorSeen.id })
    const isUnique = seen.length > 0

    // 일별 버킷 upsert — visits 항상 +1, uniques 는 신규 방문자일 때만 +1.
    await this.dbs.db
      .insert(trafficDaily)
      .values({ tenantId: tenant.id, day, visits: 1, uniques: isUnique ? 1 : 0 })
      .onConflictDoUpdate({
        target: [trafficDaily.tenantId, trafficDaily.day],
        set: {
          visits: sql`${trafficDaily.visits} + 1`,
          uniques: sql`${trafficDaily.uniques} + ${isUnique ? 1 : 0}`,
          updatedAt: new Date(),
        },
      })

    return { ok: true, unique: isUnique }
  }

  // ── 내부 ────────────────────────────────────────────────────────────────────

  /** 세션 행을 만들고 그 jti 로 JWT 를 서명해 AuthResult 로 반환. */
  private async issueSession(user: EndUserRecord): Promise<AuthResultDto> {
    const inserted = await this.dbs.db
      .insert(sessions)
      .values({
        tenantId: user.tenantId,
        userId: user.id,
        // 만료는 토큰 TTL 과 맞춘다 — 토큰이 살아있는 동안만 세션도 유효.
        expiresAt: new Date(Date.now() + this.tokens.ttlSeconds * 1000),
      })
      .returning({ id: sessions.id })
    const jti = inserted[0]!.id

    const { token, expiresIn } = await this.tokens.sign({
      jti,
      sub: user.id,
      tid: user.tenantId,
    })
    return { user: toEndUserDto(user), token, expiresIn }
  }
}
