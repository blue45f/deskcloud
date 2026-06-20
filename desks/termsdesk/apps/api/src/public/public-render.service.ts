import { Injectable, NotFoundException } from '@nestjs/common'
import {
  applyTemplateVars,
  computeContentHash,
  type PolicyType,
  type PublicRenderDto,
  type PublicVerifyDto,
  unresolvedTemplateVars,
} from '@termsdesk/shared'
import { and, desc, eq, isNotNull } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { organizations, policies, policyVersions } from '../db/schema'

import { findPortfolioPolicy, renderPortfolioPolicy } from './portfolio-legal'

export interface RenderOptions {
  /** 특정 버전 라벨(예: 'v2'). 없으면 현재 게시본. */
  versionLabel?: string
  locale?: string
  /** URL 쿼리에서 추출한 템플릿 변수 (예약어 제외). */
  vars: Record<string, string | undefined>
}

/** self-hosted 단일 조직을 가리키는 별칭 — `/public/_/policies/...` 로 slug 없이 접근. */
const DEFAULT_ORG_ALIASES = new Set(['_', 'default', 'org'])

/**
 * 공개(인증 없음) 약관 렌더링. 게시본을 그대로 노출하되, URL 파라미터로 버전 선택과
 * `{{변수}}` 치환을 지원합니다. 원문/해시는 불변 — 치환은 표시 레이어에서만 일어납니다.
 */
@Injectable()
export class PublicRenderService {
  constructor(private readonly dbs: DatabaseService) {}

  /**
   * 무인증 공개 경로에서 노출 가능한 정책 조회. 보관(archived)·비공개(private)는
   * 존재 여부를 드러내지 않도록 동일한 404 로 처리한다.
   * (API 키 경로 v1/policies 는 키 스코프 내 자사 SDK 용이라 비공개도 허용 — 여기서만 필터)
   */
  private async findPublicPolicy(
    orgId: string,
    policySlug: string
  ): Promise<typeof policies.$inferSelect> {
    const rows = await this.dbs.db
      .select()
      .from(policies)
      .where(and(eq(policies.orgId, orgId), eq(policies.slug, policySlug)))
      .limit(1)
    const policy = rows[0]
    if (!policy || policy.archivedAt || policy.visibility === 'private') {
      throw new NotFoundException('약관을 찾을 수 없습니다')
    }
    return policy
  }

  private async resolveOrg(orgSlug: string): Promise<typeof organizations.$inferSelect> {
    const rows = DEFAULT_ORG_ALIASES.has(orgSlug)
      ? await this.dbs.db.select().from(organizations).orderBy(organizations.createdAt).limit(1)
      : await this.dbs.db
          .select()
          .from(organizations)
          .where(eq(organizations.slug, orgSlug))
          .limit(1)
    const org = rows[0]
    if (!org) throw new NotFoundException('조직을 찾을 수 없습니다')
    return org
  }

  async render(orgSlug: string, policySlug: string, opts: RenderOptions): Promise<PublicRenderDto> {
    if (findPortfolioPolicy(orgSlug, policySlug)) {
      return renderPortfolioPolicy(orgSlug, policySlug, { vars: opts.vars })
    }

    const org = await this.resolveOrg(orgSlug)

    const policy = await this.findPublicPolicy(org.id, policySlug)

    // 게시 이력이 있는(해시 동결된) 모든 버전 — 버전 선택 후보.
    const publishedVersions = await this.dbs.db
      .select()
      .from(policyVersions)
      .where(and(eq(policyVersions.policyId, policy.id), isNotNull(policyVersions.contentHash)))
      .orderBy(desc(policyVersions.versionNumber))

    if (publishedVersions.length === 0) {
      throw new NotFoundException('이 약관에는 아직 게시된 버전이 없습니다')
    }

    const selected = opts.versionLabel
      ? publishedVersions.find((v) => v.versionLabel === opts.versionLabel)
      : (publishedVersions.find((v) => v.id === policy.currentVersionId) ?? publishedVersions[0])

    if (!selected) {
      throw new NotFoundException(`버전을 찾을 수 없습니다: ${opts.versionLabel}`)
    }

    const body = applyTemplateVars(selected.body, opts.vars)

    return {
      orgName: org.name,
      orgLogoUrl: org.logoUrl,
      policySlug: policy.slug,
      name: policy.name,
      type: policy.type as PolicyType,
      locale: selected.locale,
      versionId: selected.id,
      versionLabel: selected.versionLabel,
      contentHash: selected.contentHash ?? '',
      body,
      effectiveAt: selected.effectiveAt ? new Date(selected.effectiveAt).toISOString() : null,
      publishedAt: selected.publishedAt ? new Date(selected.publishedAt).toISOString() : null,
      changeSummary: selected.changeSummary,
      availableVersions: publishedVersions.map((v) => v.versionLabel),
      unresolvedVars: unresolvedTemplateVars(selected.body, opts.vars),
    }
  }

  /**
   * 변조 검증. 저장된 게시본을 지금 다시 해싱해 게시 시점 해시와 일치하는지(자가 무결성),
   * 그리고 제시한 hash 가 실제 게시 버전과 맞는지 증명한다. 원문은 절대 변형하지 않음.
   */
  async verify(
    orgSlug: string,
    policySlug: string,
    opts: { hash?: string; versionLabel?: string }
  ): Promise<PublicVerifyDto> {
    const portfolio = findPortfolioPolicy(orgSlug, policySlug)
    if (portfolio) {
      const { project, policy } = portfolio
      const stored = await computeContentHash(policy.body)
      const versionMatches = !opts.versionLabel || opts.versionLabel === policy.versionLabel
      const hashMatches = !opts.hash || opts.hash === stored
      const verified = versionMatches && hashMatches
      return {
        verified,
        orgName: project.name,
        policySlug: policy.slug,
        versionLabel: versionMatches ? policy.versionLabel : null,
        contentHash: stored,
        recomputedHash: stored,
        effectiveAt: policy.effectiveAt,
        publishedAt: policy.publishedAt,
        reason: verified
          ? undefined
          : opts.versionLabel && !versionMatches
            ? '버전을 찾을 수 없습니다'
            : '이 해시에 해당하는 게시 버전이 없습니다',
      }
    }

    const org = await this.resolveOrg(orgSlug)
    const policy = await this.findPublicPolicy(org.id, policySlug)

    const publishedVersions = await this.dbs.db
      .select()
      .from(policyVersions)
      .where(and(eq(policyVersions.policyId, policy.id), isNotNull(policyVersions.contentHash)))
      .orderBy(desc(policyVersions.versionNumber))

    const base = {
      orgName: org.name,
      policySlug: policy.slug,
      versionLabel: null,
      contentHash: opts.hash ?? null,
      recomputedHash: '',
      effectiveAt: null,
      publishedAt: null,
    }

    const target = opts.hash
      ? publishedVersions.find((v) => v.contentHash === opts.hash)
      : opts.versionLabel
        ? publishedVersions.find((v) => v.versionLabel === opts.versionLabel)
        : (publishedVersions.find((v) => v.id === policy.currentVersionId) ?? publishedVersions[0])

    if (!target) {
      return {
        ...base,
        verified: false,
        reason: opts.hash ? '이 해시에 해당하는 게시 버전이 없습니다' : '게시된 버전이 없습니다',
      }
    }

    const stored = target.contentHash ?? ''
    const recomputed = await computeContentHash(target.body)
    const selfIntact = recomputed === stored
    const matchesClaim = opts.hash ? stored === opts.hash : true
    const verified = selfIntact && matchesClaim

    return {
      verified,
      orgName: org.name,
      policySlug: policy.slug,
      versionLabel: target.versionLabel,
      contentHash: stored,
      recomputedHash: recomputed,
      effectiveAt: target.effectiveAt ? new Date(target.effectiveAt).toISOString() : null,
      publishedAt: target.publishedAt ? new Date(target.publishedAt).toISOString() : null,
      reason: verified
        ? undefined
        : !selfIntact
          ? '저장된 본문이 게시 시점 해시와 불일치 — 무결성 손상'
          : '제시한 해시가 이 버전과 불일치',
    }
  }
}
