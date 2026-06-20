import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  PLAN_LABELS,
  PLAN_PRICES_KRW,
  formatPlanPrice,
  isPlanId,
  type OrgDto,
  type PlanId,
  type UpdateOrgInput,
  type UpdateOrgPlanInput,
} from '@termsdesk/shared'
import { eq } from 'drizzle-orm'

import { AuditService } from '../common/audit.service'
import { toOrgDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { organizations } from '../db/schema'

import type { AuthUser } from '../common/request-context'

type OrgRow = typeof organizations.$inferSelect

@Injectable()
export class OrgsService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly audit: AuditService
  ) {}

  /** 조직 단건 조회 — 공개 게시 응답의 브랜딩(로고) 등에 사용. */
  async getRow(orgId: string): Promise<OrgRow> {
    const rows = await this.dbs.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)
    const org = rows[0]
    if (!org) throw new NotFoundException('조직을 찾을 수 없습니다')
    return org
  }

  async update(orgId: string, user: AuthUser, input: UpdateOrgInput): Promise<OrgDto> {
    // 스키마가 최소 1개 필드를 보장 — 전달된 필드만 부분 갱신한다.
    const patch: Partial<Pick<OrgRow, 'name' | 'logoUrl'>> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.logoUrl !== undefined) patch.logoUrl = input.logoUrl
    if (Object.keys(patch).length > 0) {
      await this.dbs.db.update(organizations).set(patch).where(eq(organizations.id, orgId))
    }
    const org = await this.getRow(orgId)

    const changes: string[] = []
    if (input.name !== undefined) changes.push(`조직명 → ${input.name}`)
    if (input.logoUrl !== undefined) changes.push(input.logoUrl ? '로고 변경' : '로고 제거')

    await this.audit.record({
      orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'org.updated',
      targetType: 'org',
      targetId: orgId,
      metadata: { summary: changes.join(' · ') },
    })
    return toOrgDto(org)
  }

  /**
   * 플랜 변경 — mock 청구. 실제 자금 이동 없이 결정만 기록한다:
   * plan/plan_changed_at 갱신 + 감사 이벤트('org.plan_changed') append.
   * 다운그레이드 시 기존 데이터는 유지되고 새 한도 초과분의 신규 생성만 차단된다.
   */
  async changePlan(orgId: string, user: AuthUser, input: UpdateOrgPlanInput): Promise<OrgDto> {
    const org = await this.getRow(orgId)
    const current: PlanId = isPlanId(org.plan) ? org.plan : 'free'
    if (current === input.plan) throw new BadRequestException('이미 사용 중인 플랜입니다')

    const changedAt = new Date()
    await this.dbs.db
      .update(organizations)
      .set({ plan: input.plan, planChangedAt: changedAt })
      .where(eq(organizations.id, orgId))

    await this.audit.record({
      orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'org.plan_changed',
      targetType: 'org',
      targetId: orgId,
      metadata: {
        summary: `플랜 변경: ${PLAN_LABELS[current]} → ${PLAN_LABELS[input.plan]} (월 ${formatPlanPrice(PLAN_PRICES_KRW[input.plan])} · 데모 — 실제 결제 없음)`,
        from: current,
        to: input.plan,
        mockBilling: true,
      },
    })
    return toOrgDto(await this.getRow(orgId))
  }
}
