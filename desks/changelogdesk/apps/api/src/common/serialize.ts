import { markdownToSafeHtml, type ChangelogEntryDto, type TenantDto } from '@changelogdesk/shared'

import type { changelogEntries, tenants } from '../db/schema'

type TenantRow = typeof tenants.$inferSelect
type EntryRow = typeof changelogEntries.$inferSelect

const iso = (d: Date | string): string =>
  d instanceof Date ? d.toISOString() : new Date(d).toISOString()
const isoOrNull = (d: Date | string | null): string | null => (d == null ? null : iso(d))

/** 테넌트 행 → 어드민 DTO(시크릿 해시는 절대 노출하지 않음). */
export function toTenantDto(row: TenantRow, opts: { monthlyLimit: number }): TenantDto {
  const overLimit = row.plan === 'free' && row.usageCount > opts.monthlyLimit
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    publishableKey: row.publishableKey,
    corsOrigins: row.corsOrigins,
    plan: row.plan,
    usageCount: row.usageCount,
    monthlyLimit: opts.monthlyLimit,
    overLimit,
    createdAt: iso(row.createdAt),
  }
}

/** 체인지로그 항목 행 → DTO. bodyHtml 은 새니타이즈된 안전 HTML(위젯 직접 주입용). */
export function toEntryDto(row: EntryRow): ChangelogEntryDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    title: row.title,
    bodyMarkdown: row.bodyMarkdown,
    bodyHtml: markdownToSafeHtml(row.bodyMarkdown),
    tag: row.tag,
    version: row.version ?? null,
    category: row.category ?? null,
    isPublished: row.isPublished,
    publishedAt: isoOrNull(row.publishedAt),
    createdAt: iso(row.createdAt),
  }
}
