import {
  isPlanId,
  type ApiKeyDto,
  type ApiKeyScope,
  type AuditEventDto,
  type ConsentDecision,
  type ConsentMethod,
  type ConsentReceiptDto,
  type MemberDto,
  type OrgDto,
  type PolicyDto,
  type PolicyType,
  type PolicyVersionDetailDto,
  type PolicyVersionSummaryDto,
  type PolicyVisibility,
  type Role,
  type VersionStatus,
} from '@termsdesk/shared'

import type {
  apiKeys,
  auditEvents,
  consentReceipts,
  organizations,
  policies,
  policyVersions,
  users,
} from '../db/schema'

type OrgRow = typeof organizations.$inferSelect
type UserRow = typeof users.$inferSelect
type PolicyRow = typeof policies.$inferSelect
type VersionRow = typeof policyVersions.$inferSelect
type ReceiptRow = typeof consentReceipts.$inferSelect
type AuditRow = typeof auditEvents.$inferSelect
type ApiKeyRow = typeof apiKeys.$inferSelect

const iso = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null)
const isoReq = (d: Date): string => new Date(d).toISOString()

export const toOrgDto = (o: OrgRow): OrgDto => ({
  id: o.id,
  name: o.name,
  slug: o.slug,
  logoUrl: o.logoUrl,
  // 알 수 없는 plan 값은 방어적으로 free 취급(PlanService.getPlan 과 동일 판정).
  plan: isPlanId(o.plan) ? o.plan : 'free',
  planChangedAt: iso(o.planChangedAt),
  createdAt: isoReq(o.createdAt),
})

export const toMemberDto = (u: UserRow): MemberDto => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role as Role,
  createdAt: isoReq(u.createdAt),
})

export const toPolicyDto = (
  p: PolicyRow,
  extra: { versionCount: number; currentVersionLabel: string | null }
): PolicyDto => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  type: p.type as PolicyType,
  jurisdiction: p.jurisdiction,
  description: p.description,
  visibility: p.visibility as PolicyVisibility,
  currentVersionId: p.currentVersionId,
  currentVersionLabel: extra.currentVersionLabel,
  versionCount: extra.versionCount,
  createdAt: isoReq(p.createdAt),
  updatedAt: isoReq(p.updatedAt),
})

export const toVersionSummary = (
  v: VersionRow,
  names: { createdByName: string | null; publishedByName: string | null } = {
    createdByName: null,
    publishedByName: null,
  }
): PolicyVersionSummaryDto => ({
  id: v.id,
  policyId: v.policyId,
  versionNumber: v.versionNumber,
  versionLabel: v.versionLabel,
  title: v.title,
  status: v.status as VersionStatus,
  locale: v.locale,
  contentHash: v.contentHash,
  requiresReconsent: v.requiresReconsent,
  changeSummary: v.changeSummary,
  effectiveAt: iso(v.effectiveAt),
  createdByName: names.createdByName,
  publishedByName: names.publishedByName,
  createdAt: isoReq(v.createdAt),
  publishedAt: iso(v.publishedAt),
})

export const toVersionDetail = (
  v: VersionRow,
  names?: { createdByName: string | null; publishedByName: string | null }
): PolicyVersionDetailDto => ({
  ...toVersionSummary(v, names),
  body: v.body,
})

export const toReceiptDto = (
  r: ReceiptRow,
  policySlug: string,
  versionLabel: string
): ConsentReceiptDto => ({
  id: r.id,
  policySlug,
  policyVersionId: r.policyVersionId,
  versionLabel,
  contentHash: r.contentHash,
  subjectRef: r.subjectRef,
  decision: r.decision as ConsentDecision,
  method: r.method as ConsentMethod,
  locale: r.locale,
  evidence: (r.evidence as ConsentReceiptDto['evidence']) ?? null,
  parentReceiptId: r.parentReceiptId,
  createdAt: isoReq(r.createdAt),
})

export const toAuditDto = (a: AuditRow): AuditEventDto => ({
  id: a.id,
  actorName: a.actorName,
  action: a.action,
  targetType: a.targetType,
  targetId: a.targetId,
  summary: a.metadata ? summarizeAudit(a.metadata as Record<string, unknown>) : null,
  ip: a.ip,
  createdAt: isoReq(a.createdAt),
})

export const toApiKeyDto = (k: ApiKeyRow): ApiKeyDto => ({
  id: k.id,
  name: k.name,
  keyPrefix: k.keyPrefix,
  scopes: k.scopes.split(',').filter(Boolean) as ApiKeyScope[],
  lastUsedAt: iso(k.lastUsedAt),
  createdAt: isoReq(k.createdAt),
  revokedAt: iso(k.revokedAt),
})

function summarizeAudit(meta: Record<string, unknown>): string | null {
  if (typeof meta.summary === 'string') return meta.summary
  const keys = Object.keys(meta)
  if (keys.length === 0) return null
  return keys
    .slice(0, 4)
    .map((k) => `${k}=${String(meta[k])}`)
    .join(', ')
}
