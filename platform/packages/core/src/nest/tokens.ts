/**
 * DI 토큰 — 소비 Desk(또는 apps/api)가 이 토큰들에 구현/설정을 바인딩한다.
 * core 는 NestJS 모듈을 강제하지 않는다(가드는 이 토큰으로 의존성을 주입받을 뿐).
 */

/** TenantService 인스턴스(@desk/core 의 TenantService). */
export const TENANT_SERVICE = Symbol('DESK_TENANT_SERVICE')

/** UsageMeter 인스턴스. */
export const USAGE_METER = Symbol('DESK_USAGE_METER')

export type AdminRole = 'owner' | 'operator' | 'support' | 'auditor'

export type AdminScope =
  | 'admin:*'
  | 'inquiries:read'
  | 'inquiries:write'
  | 'workspace:read'
  | 'tenant:read'
  | 'tenant:write'
  | 'billing:read'
  | 'billing:write'

export interface AdminAccount {
  id: string
  label: string
  role: AdminRole
  scopes: readonly AdminScope[]
  token: string
  /**
   * 이 토큰이 관리할 수 있는 앱(appId) 허용목록. 비어있거나 없으면 모든 앱(전역).
   * appId 라우트(`/api/v1/apps/:appId/...`)에서 가드가 라우트의 appId 와 대조한다.
   * appId 슬러그는 소문자로 정규화해 비교한다.
   */
  appIds?: readonly string[]
}

export type AuthenticatedAdminAccount = Omit<AdminAccount, 'token'>

/** 어드민 토큰 설정 — legacy 단일 토큰 + 운영자별 다중 토큰. */
export const CORE_OPTIONS = Symbol('DESK_CORE_OPTIONS')

export interface CoreOptions {
  /** AdminTokenGuard 가 X-Admin-Token 과 비교할 legacy fallback 값. */
  adminToken: string
  /** 운영자별 토큰. 있으면 id/role/scope 를 request context 에 부착한다. */
  adminAccounts?: readonly AdminAccount[]
}

/** request 에 부착되는 인증된 테넌트(가드가 채움). */
export const TENANT_CONTEXT_KEY = 'deskTenant' as const

/** request 에 부착되는 인증된 운영자(가드가 채움). */
export const ADMIN_CONTEXT_KEY = 'deskAdmin' as const
