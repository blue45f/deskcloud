import type { forbiddenRules, moderationLogs, reports, tenants } from '../db/schema'
import type { LogDto, ReportDto, RuleDto, TenantDto } from '@moderationdesk/shared'

type TenantRow = typeof tenants.$inferSelect
type RuleRow = typeof forbiddenRules.$inferSelect
type ReportRow = typeof reports.$inferSelect
type LogRow = typeof moderationLogs.$inferSelect

const iso = (d: Date | string): string =>
  d instanceof Date ? d.toISOString() : new Date(d).toISOString()

/** 테넌트 공개 표현 — secretKeyHash 는 절대 포함하지 않는다. */
export function toTenantDto(row: TenantRow): TenantDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    publishableKey: row.publishableKey,
    corsOrigins: row.corsOrigins ?? [],
    plan: row.plan,
    usageCount: row.usageCount,
    createdAt: iso(row.createdAt),
  }
}

/** 금칙 규칙 표현. */
export function toRuleDto(row: RuleRow): RuleDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    pattern: row.pattern,
    kind: row.kind,
    action: row.action,
    label: row.label ?? null,
    enabled: row.enabled,
    createdAt: iso(row.createdAt),
  }
}

/** 신고 표현. */
export function toReportDto(row: ReportRow): ReportDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    reason: row.reason,
    reporterId: row.reporterId ?? null,
    status: row.status,
    notes: row.notes ?? null,
    createdAt: iso(row.createdAt),
  }
}

/** 모더레이션 로그 표현. */
export function toLogDto(row: LogRow): LogDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    text: row.text,
    verdict: row.verdict,
    matchedRules: row.matchedRules ?? [],
    aiScore: row.aiScore ?? null,
    source: row.source ?? null,
    createdAt: iso(row.createdAt),
  }
}
