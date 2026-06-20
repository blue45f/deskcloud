/**
 * DI 토큰 — 소비 Desk(또는 apps/api)가 이 토큰들에 구현/설정을 바인딩한다.
 * core 는 NestJS 모듈을 강제하지 않는다(가드는 이 토큰으로 의존성을 주입받을 뿐).
 */

/** TenantService 인스턴스(@desk/core 의 TenantService). */
export const TENANT_SERVICE = Symbol('DESK_TENANT_SERVICE')

/** UsageMeter 인스턴스. */
export const USAGE_METER = Symbol('DESK_USAGE_METER')

/** 어드민 토큰 설정 — `{ adminToken: string }`. */
export const CORE_OPTIONS = Symbol('DESK_CORE_OPTIONS')

export interface CoreOptions {
  /** AdminTokenGuard 가 X-Admin-Token 과 비교할 값. */
  adminToken: string
}

/** request 에 부착되는 인증된 테넌트(가드가 채움). */
export const TENANT_CONTEXT_KEY = 'deskTenant' as const
