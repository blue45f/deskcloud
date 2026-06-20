import type { Plan, TenantDto } from '@authdesk/shared'

/** 인증 컨텍스트에서 req 에 부착되는 테넌트 레코드 키. */
export const TENANT_CONTEXT_KEY = 'authdeskTenant'

/** DB 행에서 만든 테넌트 도메인 레코드(secret 평문 없음, 해시 보유). */
export interface TenantRecord {
  id: string
  name: string
  slug: string
  publishableKey: string
  secretKeyHash: string
  corsOrigins: string[]
  plan: Plan
  createdAt: Date
  updatedAt: Date
}

/** 도메인 레코드 → 공개 DTO(secret/해시 제외). */
export function toTenantDto(rec: TenantRecord): TenantDto {
  return {
    id: rec.id,
    name: rec.name,
    slug: rec.slug,
    publishableKey: rec.publishableKey,
    corsOrigins: rec.corsOrigins,
    plan: rec.plan,
    createdAt: rec.createdAt.toISOString(),
    updatedAt: rec.updatedAt.toISOString(),
  }
}
