import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common'
import {
  PLAN_LABELS,
  PLAN_LIMITS,
  formatPlanLimit,
  isPlanId,
  isUnlimited,
  withinLimit,
  type PlanId,
  type PlanUsageDto,
} from '@termsdesk/shared'
import { and, eq, isNull, sql } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { apiKeys, apiUsage, organizations, policies, users } from '../db/schema'

/** UTC 기준 월 키 — api_usage.yyyymm ('YYYYMM'). */
export function utcMonthKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** 402 Payment Required — 플랜 한도 도달(리소스 생성 차단) + 업그레이드 안내. */
export class PlanLimitException extends HttpException {
  constructor(message: string) {
    super(
      { statusCode: HttpStatus.PAYMENT_REQUIRED, error: 'Payment Required', message },
      HttpStatus.PAYMENT_REQUIRED
    )
  }
}

/** 429 Too Many Requests — 월 API 호출 한도 소진. */
export class PlanQuotaExceededException extends HttpException {
  constructor(message: string) {
    super(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, error: 'Too Many Requests', message },
      HttpStatus.TOO_MANY_REQUESTS
    )
  }
}

/**
 * 플랜 한도 가드 + API 미터링. 한도의 단일 출처는 @termsdesk/shared 의 PLAN_LIMITS.
 * 청구는 mock — 여기서는 어떤 자금 이동도 일으키지 않고 한도 판정/카운팅만 한다.
 * 한도 -1 = 무제한. 기존(한도 도입 전) 초과 데이터는 유지되고 신규 생성만 차단된다.
 */
@Injectable()
export class PlanService {
  constructor(private readonly dbs: DatabaseService) {}

  /** 조직의 현재 플랜 — 알 수 없는 값은 방어적으로 free 취급. */
  async getPlan(orgId: string): Promise<PlanId> {
    const rows = await this.dbs.db
      .select({ plan: organizations.plan })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)
    if (!rows[0]) throw new NotFoundException('조직을 찾을 수 없습니다')
    return isPlanId(rows[0].plan) ? rows[0].plan : 'free'
  }

  private async countMembers(orgId: string): Promise<number> {
    const rows = await this.dbs.db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.orgId, orgId))
    return Number(rows[0]?.n ?? 0)
  }

  private async countActivePolicies(orgId: string): Promise<number> {
    const rows = await this.dbs.db
      .select({ n: sql<number>`count(*)::int` })
      .from(policies)
      .where(and(eq(policies.orgId, orgId), isNull(policies.archivedAt)))
    return Number(rows[0]?.n ?? 0)
  }

  private async countActiveApiKeys(orgId: string): Promise<number> {
    const rows = await this.dbs.db
      .select({ n: sql<number>`count(*)::int` })
      .from(apiKeys)
      .where(and(eq(apiKeys.orgId, orgId), isNull(apiKeys.revokedAt)))
    return Number(rows[0]?.n ?? 0)
  }

  private async apiCallsOfMonth(orgId: string, yyyymm: string): Promise<number> {
    const rows = await this.dbs.db
      .select({ count: apiUsage.count })
      .from(apiUsage)
      .where(and(eq(apiUsage.orgId, orgId), eq(apiUsage.yyyymm, yyyymm)))
      .limit(1)
    return Number(rows[0]?.count ?? 0)
  }

  private limitError(plan: PlanId, resource: string, limit: number): PlanLimitException {
    return new PlanLimitException(
      `${PLAN_LABELS[plan]} 플랜의 ${resource} 한도(${formatPlanLimit(limit)}개)에 도달했습니다 — 설정 > 플랜에서 업그레이드하세요.`
    )
  }

  /** 멤버 초대 가드 — 시트 한도 도달 시 402. */
  async assertCanAddMember(orgId: string): Promise<void> {
    const plan = await this.getPlan(orgId)
    const limit = PLAN_LIMITS[plan].members
    if (isUnlimited(limit)) return
    if (!withinLimit(limit, await this.countMembers(orgId))) {
      throw this.limitError(plan, '멤버', limit)
    }
  }

  /** 정책 생성 가드 — 활성 정책 한도 도달 시 402(보관된 정책은 미산입). */
  async assertCanAddPolicy(orgId: string): Promise<void> {
    const plan = await this.getPlan(orgId)
    const limit = PLAN_LIMITS[plan].policies
    if (isUnlimited(limit)) return
    if (!withinLimit(limit, await this.countActivePolicies(orgId))) {
      throw this.limitError(plan, '정책', limit)
    }
  }

  /** API 키 발급 가드 — 활성 키 한도 도달 시 402(폐기된 키는 미산입). */
  async assertCanAddApiKey(orgId: string): Promise<void> {
    const plan = await this.getPlan(orgId)
    const limit = PLAN_LIMITS[plan].apiKeys
    if (isUnlimited(limit)) return
    if (!withinLimit(limit, await this.countActiveApiKeys(orgId))) {
      throw this.limitError(plan, 'API 키', limit)
    }
  }

  /**
   * API 키 경유 호출 1건 미터링 — 월 카운터를 원자적 UPSERT 로 +1.
   * 한도가 있으면 `count < limit` 조건부 증가(setWhere)로 초과 시 증가 없이 429.
   * 즉 정확히 한도까지만 카운트되고, 거부된 호출은 사용량을 부풀리지 않는다.
   */
  async meterApiCall(orgId: string): Promise<void> {
    const plan = await this.getPlan(orgId)
    const limit = PLAN_LIMITS[plan].apiCallsPerMonth
    const month = utcMonthKey()
    const base = this.dbs.db.insert(apiUsage).values({ orgId, yyyymm: month, count: 1 })
    const set = { count: sql`${apiUsage.count} + 1`, updatedAt: new Date() }
    const target = [apiUsage.orgId, apiUsage.yyyymm]

    if (isUnlimited(limit)) {
      await base.onConflictDoUpdate({ target, set })
      return
    }
    const rows = await base
      .onConflictDoUpdate({ target, set, setWhere: sql`${apiUsage.count} < ${limit}` })
      .returning({ count: apiUsage.count })
    if (!rows[0]) {
      throw new PlanQuotaExceededException(
        `이번 달 API 호출 한도(${formatPlanLimit(limit)}회)를 모두 사용했습니다 — ${PLAN_LABELS[plan]} 플랜 상위로 업그레이드하면 한도가 늘어납니다.`
      )
    }
  }

  /** 현재 플랜·한도·사용량 묶음 — 설정 플랜 카드·대시보드 미터 카드용. */
  async usage(orgId: string): Promise<PlanUsageDto> {
    const rows = await this.dbs.db
      .select({ plan: organizations.plan, planChangedAt: organizations.planChangedAt })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)
    const org = rows[0]
    if (!org) throw new NotFoundException('조직을 찾을 수 없습니다')
    const plan: PlanId = isPlanId(org.plan) ? org.plan : 'free'

    const month = utcMonthKey()
    const [members, activePolicies, activeKeys, apiCallsThisMonth] = await Promise.all([
      this.countMembers(orgId),
      this.countActivePolicies(orgId),
      this.countActiveApiKeys(orgId),
      this.apiCallsOfMonth(orgId, month),
    ])

    return {
      plan,
      planChangedAt: org.planChangedAt ? new Date(org.planChangedAt).toISOString() : null,
      limits: PLAN_LIMITS[plan],
      usage: { members, policies: activePolicies, apiKeys: activeKeys, apiCallsThisMonth },
      month: `${month.slice(0, 4)}-${month.slice(4)}`,
    }
  }
}
