import type { documents, tenants } from '../db/schema'
import type { DocumentDto, TenantDto } from '@searchdesk/shared'

type TenantRow = typeof tenants.$inferSelect
type DocumentRow = typeof documents.$inferSelect

const iso = (d: Date | string): string =>
  d instanceof Date ? d.toISOString() : new Date(d).toISOString()

/** secret 평문/해시는 절대 노출하지 않는다(가입/rotate 응답만 예외, 그건 서비스가 직접 합성). */
export function toTenantDto(row: TenantRow): TenantDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    publishableKey: row.publishableKey,
    corsOrigins: row.corsOrigins,
    docCount: row.docCount,
    createdAt: iso(row.createdAt),
  }
}

export function toDocumentDto(row: DocumentRow): DocumentDto {
  return {
    id: row.docId,
    index: row.indexName,
    title: row.title,
    body: row.body,
    url: row.url ?? null,
    category: row.category ?? null,
    tags: row.tags,
    attrs: row.attrs ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}
