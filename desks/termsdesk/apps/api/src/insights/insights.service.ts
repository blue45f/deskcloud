import { Injectable } from '@nestjs/common'
import { and, eq, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm'

import { toApiKeyDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { apiKeys, auditEvents, consentReceipts, policies, policyVersions } from '../db/schema'

import type { ApiKeyUsageDto, ConsentTrendPointDto, ReconsentStatusDto } from '@termsdesk/shared'

/** 일자 키(UTC) — DB 의 date_trunc(UTC 세션)와 동일 기준으로 zero-fill 매칭. */
function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** 오늘 포함 직전 days 일의 시작(UTC 자정). */
function sinceUtcDays(days: number): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)))
}

/**
 * 운영 인사이트 집계 — 대시보드 전용 읽기 경로.
 * 원본(consent_receipts·audit_events)은 append-only 그대로 두고 조회만 한다.
 */
@Injectable()
export class InsightsService {
  constructor(private readonly dbs: DatabaseService) {}

  /** 동의 추이: 최근 days 일을 일자(UTC) 버킷으로 집계, 빈 날은 0 으로 채움(오름차순). */
  async consentTrend(orgId: string, days = 30): Promise<ConsentTrendPointDto[]> {
    const span = Math.min(Math.max(Math.trunc(days) || 30, 7), 90)
    const since = sinceUtcDays(span)
    const dayExpr = sql<string>`to_char(date_trunc('day', ${consentReceipts.createdAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`

    const rows = await this.dbs.db
      .select({
        day: dayExpr,
        decision: consentReceipts.decision,
        count: sql<number>`count(*)::int`,
      })
      .from(consentReceipts)
      .where(and(eq(consentReceipts.orgId, orgId), gte(consentReceipts.createdAt, since)))
      .groupBy(dayExpr, consentReceipts.decision)

    const byDay = new Map<string, { accepted: number; declined: number; withdrawn: number }>()
    for (const r of rows) {
      const bucket = byDay.get(r.day) ?? { accepted: 0, declined: 0, withdrawn: 0 }
      if (r.decision === 'accepted' || r.decision === 'declined' || r.decision === 'withdrawn') {
        bucket[r.decision] += Number(r.count)
      }
      byDay.set(r.day, bucket)
    }

    const points: ConsentTrendPointDto[] = []
    for (let i = 0; i < span; i += 1) {
      const date = utcDayKey(new Date(since.getTime() + i * 86_400_000))
      const b = byDay.get(date) ?? { accepted: 0, declined: 0, withdrawn: 0 }
      points.push({ date, ...b, total: b.accepted + b.declined + b.withdrawn })
    }
    return points
  }

  /**
   * 재동의 필요 현황 — 게시 이력이 있는(현재 게시본 보유) 정책별로,
   * 현재 게시본 해시에 'accepted' 영수증이 없는 고유 subjectRef 수를 센다.
   * (consents.hasAcceptedCurrent 와 동일한 판정: 현재 해시의 accepted 영수증 보유 여부)
   */
  async reconsentStatus(orgId: string): Promise<ReconsentStatusDto[]> {
    const pols = await this.dbs.db
      .select({
        id: policies.id,
        slug: policies.slug,
        name: policies.name,
        currentVersionId: policies.currentVersionId,
      })
      .from(policies)
      .where(
        and(
          eq(policies.orgId, orgId),
          isNull(policies.archivedAt),
          isNotNull(policies.currentVersionId)
        )
      )
    if (pols.length === 0) return []

    const currentIds = pols.map((p) => p.currentVersionId!).filter(Boolean)
    const versions = await this.dbs.db
      .select({
        id: policyVersions.id,
        versionLabel: policyVersions.versionLabel,
        contentHash: policyVersions.contentHash,
      })
      .from(policyVersions)
      .where(inArray(policyVersions.id, currentIds))
    const versionById = new Map(versions.map((v) => [v.id, v]))

    // 정책별 고유 subjectRef 전체 수
    const totals = await this.dbs.db
      .select({
        policyId: consentReceipts.policyId,
        n: sql<number>`count(distinct ${consentReceipts.subjectRef})::int`,
      })
      .from(consentReceipts)
      .where(eq(consentReceipts.orgId, orgId))
      .groupBy(consentReceipts.policyId)
    const totalByPolicy = new Map(totals.map((t) => [t.policyId, Number(t.n)]))

    // 현재 게시본 해시와 일치하는 'accepted' 영수증 보유 subjectRef 수 — 해시는 정책마다
    // 다르므로 policies→현재 버전 join 후 영수증 해시와 컬럼끼리 비교한다.
    const accepted = await this.dbs.db
      .select({
        policyId: consentReceipts.policyId,
        n: sql<number>`count(distinct ${consentReceipts.subjectRef})::int`,
      })
      .from(consentReceipts)
      .innerJoin(policies, eq(policies.id, consentReceipts.policyId))
      .innerJoin(policyVersions, eq(policyVersions.id, policies.currentVersionId))
      .where(
        and(
          eq(consentReceipts.orgId, orgId),
          eq(consentReceipts.decision, 'accepted'),
          isNotNull(policyVersions.contentHash),
          eq(consentReceipts.contentHash, policyVersions.contentHash)
        )
      )
      .groupBy(consentReceipts.policyId)
    const acceptedByPolicy = new Map(accepted.map((a) => [a.policyId, Number(a.n)]))

    return pols
      .map((p) => {
        const v = p.currentVersionId ? versionById.get(p.currentVersionId) : undefined
        const totalSubjects = totalByPolicy.get(p.id) ?? 0
        const acceptedCurrent = acceptedByPolicy.get(p.id) ?? 0
        return {
          policyId: p.id,
          policySlug: p.slug,
          policyName: p.name,
          currentVersionLabel: v?.versionLabel ?? null,
          totalSubjects,
          acceptedCurrent,
          pendingReconsent: Math.max(totalSubjects - acceptedCurrent, 0),
        }
      })
      .sort((a, b) => b.pendingReconsent - a.pendingReconsent)
  }

  /**
   * API 키 사용 현황. 키별 호출 카운터 컬럼은 추가하지 않는다 —
   * 키별로는 last_used_at(가드가 베스트에포트 갱신), 호출량은 audit_events
   * (action='consent.recorded', API 키 경유 쓰기) 최근 30일 집계로 보완.
   */
  async apiKeyUsage(orgId: string): Promise<ApiKeyUsageDto> {
    const rows = await this.dbs.db.select().from(apiKeys).where(eq(apiKeys.orgId, orgId))
    const keys = rows.map(toApiKeyDto).sort((a, b) => {
      // 최근 사용 우선, 미사용은 생성일 역순으로 뒤에
      const au = a.lastUsedAt ? Date.parse(a.lastUsedAt) : -1
      const bu = b.lastUsedAt ? Date.parse(b.lastUsedAt) : -1
      if (au !== bu) return bu - au
      return Date.parse(b.createdAt) - Date.parse(a.createdAt)
    })

    const since = sinceUtcDays(30)
    const writes = await this.dbs.db
      .select({ n: sql<number>`count(*)::int` })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.orgId, orgId),
          eq(auditEvents.action, 'consent.recorded'),
          gte(auditEvents.createdAt, since)
        )
      )

    return { keys, consentWrites30d: Number(writes[0]?.n ?? 0) }
  }
}
