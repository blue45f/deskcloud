import type { tenants } from '../db/schema'

export type TenantRow = typeof tenants.$inferSelect

/** 가드가 해석해 요청에 붙이는 테넌트 컨텍스트. */
export interface TenantRequest {
  tenant: TenantRow
  /** 어드민 마스터 토큰(ADMIN_TOKEN)으로 인증되었는지(테넌트 secret 키가 아니라). */
  isAdminMaster?: boolean
}
