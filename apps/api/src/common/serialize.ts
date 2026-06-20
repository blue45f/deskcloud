import type { fileObjects, tenants } from '../db/schema'
import type { FileObjectDto, StorageDriver, TenantDto } from '@filedesk/shared'

type TenantRow = typeof tenants.$inferSelect
type FileRow = typeof fileObjects.$inferSelect

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
    usageCount: row.usageCount,
    createdAt: iso(row.createdAt),
  }
}

/** 파일 객체 → 메타데이터 DTO(바이트 미포함). */
export function toFileObjectDto(row: FileRow): FileObjectDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    key: row.key,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    visibility: row.visibility,
    storageDriver: row.storageDriver as StorageDriver,
    createdAt: iso(row.createdAt),
  }
}
