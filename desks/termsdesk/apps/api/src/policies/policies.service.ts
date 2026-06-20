import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'

import { AuditService } from '../common/audit.service'
import { randomUUID } from '../common/crypto'
import { PlanService } from '../common/plan.service'
import { toPolicyDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { policies, policyVersions } from '../db/schema'

import type { AuthUser } from '../common/request-context'
import type { CreatePolicyInput, PolicyDto, UpdatePolicyInput } from '@termsdesk/shared'

@Injectable()
export class PoliciesService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly audit: AuditService,
    private readonly plans: PlanService
  ) {}

  async list(orgId: string): Promise<PolicyDto[]> {
    const rows = await this.dbs.db
      .select()
      .from(policies)
      .where(and(eq(policies.orgId, orgId), isNull(policies.archivedAt)))
      .orderBy(desc(policies.updatedAt))
    if (rows.length === 0) return []

    const ids = rows.map((p) => p.id)
    const versions = await this.dbs.db
      .select({
        id: policyVersions.id,
        policyId: policyVersions.policyId,
        versionLabel: policyVersions.versionLabel,
      })
      .from(policyVersions)
      .where(inArray(policyVersions.policyId, ids))

    const countByPolicy = new Map<string, number>()
    const labelById = new Map<string, string>()
    for (const v of versions) {
      countByPolicy.set(v.policyId, (countByPolicy.get(v.policyId) ?? 0) + 1)
      labelById.set(v.id, v.versionLabel)
    }
    return rows.map((p) =>
      toPolicyDto(p, {
        versionCount: countByPolicy.get(p.id) ?? 0,
        currentVersionLabel: p.currentVersionId
          ? (labelById.get(p.currentVersionId) ?? null)
          : null,
      })
    )
  }

  /** id 또는 slug 로 단일 정책 조회. */
  async findOne(orgId: string, idOrSlug: string): Promise<PolicyDto> {
    const p = await this.getRow(orgId, idOrSlug)
    const versions = await this.dbs.db
      .select({ id: policyVersions.id, versionLabel: policyVersions.versionLabel })
      .from(policyVersions)
      .where(eq(policyVersions.policyId, p.id))
    const currentLabel = p.currentVersionId
      ? (versions.find((v) => v.id === p.currentVersionId)?.versionLabel ?? null)
      : null
    return toPolicyDto(p, { versionCount: versions.length, currentVersionLabel: currentLabel })
  }

  async getRow(orgId: string, idOrSlug: string): Promise<typeof policies.$inferSelect> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idOrSlug)
    const rows = await this.dbs.db
      .select()
      .from(policies)
      .where(
        and(
          eq(policies.orgId, orgId),
          isUuid ? eq(policies.id, idOrSlug) : eq(policies.slug, idOrSlug)
        )
      )
      .limit(1)
    const p = rows[0]
    if (!p) throw new NotFoundException('정책을 찾을 수 없습니다')
    return p
  }

  async create(orgId: string, user: AuthUser, input: CreatePolicyInput): Promise<PolicyDto> {
    // 플랜 정책 한도(활성 기준, 보관 제외) — 초과 시 402 + 업그레이드 안내.
    await this.plans.assertCanAddPolicy(orgId)
    const existing = await this.dbs.db
      .select({ id: policies.id })
      .from(policies)
      .where(and(eq(policies.orgId, orgId), eq(policies.slug, input.slug)))
      .limit(1)
    if (existing[0]) throw new ConflictException(`이미 사용 중인 slug 입니다: ${input.slug}`)

    const id = randomUUID()
    await this.dbs.db.insert(policies).values({
      id,
      orgId,
      slug: input.slug,
      name: input.name,
      type: input.type,
      jurisdiction: input.jurisdiction,
      description: input.description ?? null,
    })
    await this.audit.record({
      orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'policy.created',
      targetType: 'policy',
      targetId: id,
      metadata: { summary: `정책 생성: ${input.name} (${input.slug})` },
    })
    return this.findOne(orgId, id)
  }

  async update(
    orgId: string,
    user: AuthUser,
    idOrSlug: string,
    input: UpdatePolicyInput
  ): Promise<PolicyDto> {
    const p = await this.getRow(orgId, idOrSlug)
    // 노출 제어만 변경 — 게시본·content_hash 에는 일절 손대지 않는다.
    const visibilityChanged = input.visibility !== undefined && input.visibility !== p.visibility
    await this.dbs.db
      .update(policies)
      .set({
        name: input.name ?? p.name,
        description: input.description ?? p.description,
        jurisdiction: input.jurisdiction ?? p.jurisdiction,
        visibility: input.visibility ?? p.visibility,
        updatedAt: new Date(),
      })
      .where(eq(policies.id, p.id))
    await this.audit.record({
      orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: visibilityChanged ? 'policy.visibility_changed' : 'policy.updated',
      targetType: 'policy',
      targetId: p.id,
      metadata: {
        summary: visibilityChanged
          ? `공개 설정 변경: ${p.name} → ${input.visibility === 'private' ? '비공개' : '공개'}`
          : `정책 메타데이터 수정: ${p.name}`,
      },
    })
    return this.findOne(orgId, p.id)
  }

  async archive(orgId: string, user: AuthUser, idOrSlug: string): Promise<{ ok: true }> {
    const p = await this.getRow(orgId, idOrSlug)
    await this.dbs.db
      .update(policies)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(policies.id, p.id))
    await this.audit.record({
      orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'policy.archived',
      targetType: 'policy',
      targetId: p.id,
      metadata: { summary: `정책 보관: ${p.name}` },
    })
    return { ok: true }
  }
}
