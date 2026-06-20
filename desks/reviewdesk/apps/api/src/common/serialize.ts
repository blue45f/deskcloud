import type { reviews, tenants } from '../db/schema'
import type { AdminReviewDto, PublicReviewDto, TenantDto } from '@reviewdesk/shared'

type TenantRow = typeof tenants.$inferSelect
type ReviewRow = typeof reviews.$inferSelect

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
    autoApprove: row.autoApprove,
    usageCount: row.usageCount,
    createdAt: iso(row.createdAt),
  }
}

/** 공개(위젯) 리뷰 — authorEmail·meta·source 등 비공개 필드 제외. */
export function toPublicReviewDto(row: ReviewRow): PublicReviewDto {
  return {
    id: row.id,
    subjectId: row.subjectId,
    subjectLabel: row.subjectLabel ?? null,
    rating: row.rating,
    title: row.title ?? null,
    body: row.body,
    authorName: row.authorName,
    featured: row.featured,
    reply: row.reply ?? null,
    createdAt: iso(row.createdAt),
  }
}

/** 어드민 리뷰 — 전체 필드(비공개 포함). */
export function toAdminReviewDto(row: ReviewRow): AdminReviewDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    subjectId: row.subjectId,
    subjectLabel: row.subjectLabel ?? null,
    rating: row.rating,
    title: row.title ?? null,
    body: row.body,
    authorName: row.authorName,
    authorEmail: row.authorEmail ?? null,
    status: row.status,
    featured: row.featured,
    reply: row.reply ?? null,
    source: row.source ?? null,
    meta: row.meta ?? null,
    createdAt: iso(row.createdAt),
  }
}
