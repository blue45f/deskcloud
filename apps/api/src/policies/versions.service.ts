import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import {
  computeContentHash,
  type CreateVersionInput,
  type PolicyVersionDetailDto,
  type PolicyVersionSummaryDto,
  type PublishVersionInput,
  type UpdateVersionInput,
} from '@termsdesk/shared'
import { and, desc, eq } from 'drizzle-orm'

import { AuditService } from '../common/audit.service'
import { randomUUID } from '../common/crypto'
import { toVersionDetail, toVersionSummary } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { policies, policyVersions, users } from '../db/schema'

import { PoliciesService } from './policies.service'

import type { AuthUser } from '../common/request-context'

@Injectable()
export class VersionsService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly policiesService: PoliciesService,
    private readonly audit: AuditService
  ) {}

  private async nameMap(orgId: string): Promise<Map<string, string>> {
    const rows = await this.dbs.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.orgId, orgId))
    return new Map(rows.map((r) => [r.id, r.name]))
  }

  async listForPolicy(orgId: string, policyIdOrSlug: string): Promise<PolicyVersionSummaryDto[]> {
    const policy = await this.policiesService.getRow(orgId, policyIdOrSlug)
    const rows = await this.dbs.db
      .select()
      .from(policyVersions)
      .where(eq(policyVersions.policyId, policy.id))
      .orderBy(desc(policyVersions.versionNumber))
    const names = await this.nameMap(orgId)
    return rows.map((v) =>
      toVersionSummary(v, {
        createdByName: v.createdBy ? (names.get(v.createdBy) ?? null) : null,
        publishedByName: v.publishedBy ? (names.get(v.publishedBy) ?? null) : null,
      })
    )
  }

  async getVersionRow(
    orgId: string,
    versionId: string
  ): Promise<typeof policyVersions.$inferSelect> {
    const rows = await this.dbs.db
      .select()
      .from(policyVersions)
      .where(and(eq(policyVersions.orgId, orgId), eq(policyVersions.id, versionId)))
      .limit(1)
    const v = rows[0]
    if (!v) throw new NotFoundException('버전을 찾을 수 없습니다')
    return v
  }

  async getVersion(orgId: string, versionId: string): Promise<PolicyVersionDetailDto> {
    const v = await this.getVersionRow(orgId, versionId)
    const names = await this.nameMap(orgId)
    return toVersionDetail(v, {
      createdByName: v.createdBy ? (names.get(v.createdBy) ?? null) : null,
      publishedByName: v.publishedBy ? (names.get(v.publishedBy) ?? null) : null,
    })
  }

  async createDraft(
    orgId: string,
    user: AuthUser,
    policyIdOrSlug: string,
    input: CreateVersionInput
  ): Promise<PolicyVersionDetailDto> {
    const policy = await this.policiesService.getRow(orgId, policyIdOrSlug)
    const last = await this.dbs.db
      .select({ n: policyVersions.versionNumber })
      .from(policyVersions)
      .where(eq(policyVersions.policyId, policy.id))
      .orderBy(desc(policyVersions.versionNumber))
      .limit(1)
    const versionNumber = (last[0]?.n ?? 0) + 1
    const id = randomUUID()
    await this.dbs.db.insert(policyVersions).values({
      id,
      orgId,
      policyId: policy.id,
      versionNumber,
      versionLabel: `v${versionNumber}`,
      title: input.title,
      body: input.body,
      locale: input.locale,
      status: 'draft',
      changeSummary: input.changeSummary ?? null,
      createdBy: user.userId,
    })
    await this.audit.record({
      orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'version.created',
      targetType: 'policy_version',
      targetId: id,
      metadata: { summary: `초안 작성: ${policy.name} v${versionNumber}` },
    })
    return this.getVersion(orgId, id)
  }

  async updateDraft(
    orgId: string,
    user: AuthUser,
    versionId: string,
    input: UpdateVersionInput
  ): Promise<PolicyVersionDetailDto> {
    const v = await this.getVersionRow(orgId, versionId)
    if (v.status !== 'draft') {
      throw new ConflictException('게시된 버전은 수정할 수 없습니다. 새 버전을 만드세요.')
    }
    await this.dbs.db
      .update(policyVersions)
      .set({
        title: input.title ?? v.title,
        body: input.body ?? v.body,
        changeSummary: input.changeSummary ?? v.changeSummary,
      })
      .where(eq(policyVersions.id, v.id))
    await this.audit.record({
      orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'version.updated',
      targetType: 'policy_version',
      targetId: v.id,
      metadata: { summary: `초안 수정: ${v.versionLabel}` },
    })
    return this.getVersion(orgId, v.id)
  }

  /** 게시 — content_hash 동결, 현재 버전으로 승격, 이전 현재본은 보관(archived). */
  async publish(
    orgId: string,
    user: AuthUser,
    versionId: string,
    input: PublishVersionInput
  ): Promise<PolicyVersionDetailDto> {
    const v = await this.getVersionRow(orgId, versionId)
    if (v.status === 'published') {
      throw new ConflictException('이미 게시된 버전입니다 (불변)')
    }
    const contentHash = await computeContentHash(v.body)
    const now = new Date()
    const effectiveAt = input.effectiveAt ? new Date(input.effectiveAt) : now

    await this.dbs.db
      .update(policyVersions)
      .set({
        status: 'published',
        contentHash,
        publishedAt: now,
        publishedBy: user.userId,
        effectiveAt,
        requiresReconsent: input.requiresReconsent,
        changeSummary: input.changeSummary ?? v.changeSummary,
      })
      .where(eq(policyVersions.id, v.id))

    const policy = await this.policiesService.getRow(orgId, v.policyId)
    if (policy.currentVersionId && policy.currentVersionId !== v.id) {
      await this.dbs.db
        .update(policyVersions)
        .set({ status: 'archived', archivedAt: now })
        .where(eq(policyVersions.id, policy.currentVersionId))
    }
    await this.dbs.db
      .update(policies)
      .set({ currentVersionId: v.id, updatedAt: now })
      .where(eq(policies.id, policy.id))

    await this.audit.record({
      orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'version.published',
      targetType: 'policy_version',
      targetId: v.id,
      metadata: {
        summary: `게시: ${policy.name} ${v.versionLabel}${
          input.requiresReconsent ? ' · 재동의 필요' : ''
        }`,
        contentHash,
      },
    })
    return this.getVersion(orgId, v.id)
  }
}
