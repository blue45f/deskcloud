import { BadRequestException, Injectable } from '@nestjs/common'
import { and, desc, eq, gte, lte, type SQL, sql } from 'drizzle-orm'

import { AuditService } from '../common/audit.service'
import { randomUUID } from '../common/crypto'
import { toReceiptDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { consentReceipts, policies, policyVersions } from '../db/schema'
import { PoliciesService } from '../policies/policies.service'

import type {
  ConsentReceiptCreatedDto,
  ConsentReceiptDto,
  RecordConsentInput,
} from '@termsdesk/shared'

export interface ListReceiptsFilter {
  subjectRef?: string
  policySlug?: string
  decision?: string
  method?: string
  /** ISO 날짜 — createdAt 범위(포함). */
  from?: string
  to?: string
  offset?: number
  limit?: number
}

@Injectable()
export class ConsentsService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly policiesService: PoliciesService,
    private readonly audit: AuditService
  ) {}

  async record(
    orgId: string,
    input: RecordConsentInput,
    ip: string
  ): Promise<ConsentReceiptCreatedDto> {
    const policy = await this.policiesService.getRow(orgId, input.policySlug)
    if (!policy.currentVersionId) {
      throw new BadRequestException('이 정책에는 아직 게시된 버전이 없습니다')
    }
    const curRows = await this.dbs.db
      .select()
      .from(policyVersions)
      .where(eq(policyVersions.id, policy.currentVersionId))
      .limit(1)
    let version = curRows[0]!

    // 클라이언트가 본 해시가 현재본과 다르면, 그 해시에 해당하는 실제 버전에 귀속(증거 정확도)
    if (input.contentHash && input.contentHash !== version.contentHash) {
      const matchRows = await this.dbs.db
        .select()
        .from(policyVersions)
        .where(
          and(
            eq(policyVersions.policyId, policy.id),
            eq(policyVersions.contentHash, input.contentHash)
          )
        )
        .limit(1)
      if (matchRows[0]) version = matchRows[0]
    }

    const contentHash = version.contentHash ?? input.contentHash ?? ''
    const id = randomUUID()
    await this.dbs.db.insert(consentReceipts).values({
      id,
      orgId,
      policyId: policy.id,
      policyVersionId: version.id,
      contentHash,
      subjectRef: input.subjectRef,
      decision: input.decision,
      method: input.method,
      locale: input.locale,
      evidence: { ...(input.evidence ?? {}), ip },
    })
    await this.audit.record({
      orgId,
      actorName: `subject:${input.subjectRef}`,
      action: 'consent.recorded',
      targetType: 'consent_receipt',
      targetId: id,
      ip,
      metadata: {
        summary: `동의 기록: ${input.subjectRef} → ${policy.name} ${version.versionLabel} (${input.decision})`,
      },
    })
    return {
      receiptId: id,
      policySlug: policy.slug,
      versionLabel: version.versionLabel,
      contentHash,
      decision: input.decision,
      createdAt: new Date().toISOString(),
    }
  }

  /** 이 대상이 주어진 해시(현재본)에 'accepted' 영수증을 가지고 있는가. */
  async hasAcceptedCurrent(
    orgId: string,
    subjectRef: string,
    contentHash: string | null
  ): Promise<boolean> {
    if (!contentHash) return false
    const rows = await this.dbs.db
      .select({ id: consentReceipts.id })
      .from(consentReceipts)
      .where(
        and(
          eq(consentReceipts.orgId, orgId),
          eq(consentReceipts.subjectRef, subjectRef),
          eq(consentReceipts.decision, 'accepted'),
          eq(consentReceipts.contentHash, contentHash)
        )
      )
      .limit(1)
    return Boolean(rows[0])
  }

  /** 공유 필터 조건 — list/count 가 같은 WHERE 를 쓰도록. */
  private receiptConds(orgId: string, f: ListReceiptsFilter): SQL | undefined {
    const conds = [eq(consentReceipts.orgId, orgId)]
    if (f.subjectRef) conds.push(eq(consentReceipts.subjectRef, f.subjectRef))
    if (f.policySlug) conds.push(eq(policies.slug, f.policySlug))
    if (f.decision) conds.push(eq(consentReceipts.decision, f.decision))
    if (f.method) conds.push(eq(consentReceipts.method, f.method))
    if (f.from) conds.push(gte(consentReceipts.createdAt, new Date(f.from)))
    if (f.to) conds.push(lte(consentReceipts.createdAt, new Date(f.to)))
    return and(...conds)
  }

  async list(orgId: string, filter: ListReceiptsFilter): Promise<ConsentReceiptDto[]> {
    const rows = await this.dbs.db
      .select({
        r: consentReceipts,
        slug: policies.slug,
        label: policyVersions.versionLabel,
      })
      .from(consentReceipts)
      .innerJoin(policies, eq(policies.id, consentReceipts.policyId))
      .innerJoin(policyVersions, eq(policyVersions.id, consentReceipts.policyVersionId))
      .where(this.receiptConds(orgId, filter))
      .orderBy(desc(consentReceipts.createdAt))
      .limit(Math.min(filter.limit ?? 100, 500))
      .offset(Math.max(filter.offset ?? 0, 0))
    return rows.map((x) => toReceiptDto(x.r, x.slug, x.label))
  }

  /** 같은 필터의 전체 건수(페이지네이션 X-Total-Count 용). */
  async count(orgId: string, filter: ListReceiptsFilter): Promise<number> {
    const rows = await this.dbs.db
      .select({ c: sql<number>`count(*)` })
      .from(consentReceipts)
      .innerJoin(policies, eq(policies.id, consentReceipts.policyId))
      .where(this.receiptConds(orgId, filter))
    return Number(rows[0]?.c ?? 0)
  }
}
