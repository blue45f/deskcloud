import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, eq, sql } from 'drizzle-orm'

import { AuditService } from '../common/audit.service'
import { hashPassword, randomUUID } from '../common/crypto'
import { PlanService } from '../common/plan.service'
import { toMemberDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { users } from '../db/schema'

import type { AuthUser } from '../common/request-context'
import type { InviteMemberInput, MemberDto, UpdateMemberInput } from '@termsdesk/shared'

@Injectable()
export class MembersService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly audit: AuditService,
    private readonly plans: PlanService
  ) {}

  async list(orgId: string): Promise<MemberDto[]> {
    const rows = await this.dbs.db
      .select()
      .from(users)
      .where(eq(users.orgId, orgId))
      .orderBy(asc(users.createdAt))
    return rows.map(toMemberDto)
  }

  private async getMember(orgId: string, id: string): Promise<typeof users.$inferSelect> {
    const rows = await this.dbs.db
      .select()
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(users.id, id)))
      .limit(1)
    const member = rows[0]
    if (!member) throw new NotFoundException('멤버를 찾을 수 없습니다')
    return member
  }

  private async ownerCount(orgId: string): Promise<number> {
    const rows = await this.dbs.db
      .select({ c: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(users.role, 'owner')))
    return Number(rows[0]?.c ?? 0)
  }

  async invite(orgId: string, actor: AuthUser, input: InviteMemberInput): Promise<MemberDto> {
    // 플랜 시트 한도 — 초과 시 402 + 업그레이드 안내(mock 청구: 결제 없이 플랜 변경 가능).
    await this.plans.assertCanAddMember(orgId)
    const email = input.email.toLowerCase()
    const existing = await this.dbs.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(users.email, email)))
      .limit(1)
    if (existing[0]) throw new ConflictException('이미 등록된 이메일입니다')

    const id = randomUUID()
    const createdAt = new Date()
    await this.dbs.db.insert(users).values({
      id,
      orgId,
      email,
      name: input.name,
      role: input.role,
      passwordHash: hashPassword(input.password),
      createdAt,
    })
    await this.audit.record({
      orgId,
      actorUserId: actor.userId,
      actorName: actor.name,
      action: 'member.invited',
      targetType: 'user',
      targetId: id,
      metadata: { summary: `멤버 추가: ${input.name} (${input.role})` },
    })
    return { id, email, name: input.name, role: input.role, createdAt: createdAt.toISOString() }
  }

  async updateRole(
    orgId: string,
    actor: AuthUser,
    id: string,
    input: UpdateMemberInput
  ): Promise<MemberDto> {
    const member = await this.getMember(orgId, id)
    if (member.role === 'owner' && input.role !== 'owner' && (await this.ownerCount(orgId)) <= 1) {
      throw new BadRequestException('마지막 소유자의 역할은 변경할 수 없습니다')
    }
    await this.dbs.db.update(users).set({ role: input.role }).where(eq(users.id, id))
    await this.audit.record({
      orgId,
      actorUserId: actor.userId,
      actorName: actor.name,
      action: 'member.role_changed',
      targetType: 'user',
      targetId: id,
      metadata: { summary: `역할 변경: ${member.name} (${member.role} → ${input.role})` },
    })
    return toMemberDto({ ...member, role: input.role })
  }

  async remove(orgId: string, actor: AuthUser, id: string): Promise<{ ok: true }> {
    if (id === actor.userId) throw new BadRequestException('자기 자신은 삭제할 수 없습니다')
    const member = await this.getMember(orgId, id)
    if (member.role === 'owner' && (await this.ownerCount(orgId)) <= 1) {
      throw new BadRequestException('마지막 소유자는 삭제할 수 없습니다')
    }
    await this.dbs.db.delete(users).where(eq(users.id, id))
    await this.audit.record({
      orgId,
      actorUserId: actor.userId,
      actorName: actor.name,
      action: 'member.removed',
      targetType: 'user',
      targetId: id,
      metadata: { summary: `멤버 삭제: ${member.name} (${member.email})` },
    })
    return { ok: true }
  }
}
