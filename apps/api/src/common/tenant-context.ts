import type { TenantRow } from '../tenants/tenants.service'
import type { Request } from 'express'

/**
 * 자격증명 스코프 — 어드민 가드(SecretKeyGuard)가 어떤 키로 통과했는지.
 *   - 'tenant'   : 테넌트 secret 키(x-sk) → 대상 테넌트 1곳으로만 스코프.
 *   - 'operator' : 글로벌 ADMIN_TOKEN(x-admin-token) → 플랫폼 운영자(모든 테넌트).
 */
export type AuthScope = 'tenant' | 'operator'

/** 가드가 해석한 테넌트를 요청에 실어 컨트롤러로 전달한다. */
export interface TenantRequest extends Request {
  tenant?: TenantRow
  /** 어드민 가드 통과 시 자격증명 스코프(통계 등에서 tenant/operator 분기). */
  authScope?: AuthScope
}

/** 요청에서 해석된 자격증명 스코프를 꺼낸다(어드민 가드 통과 후엔 항상 존재, 기본 'tenant'). */
export function scopeOf(req: TenantRequest): AuthScope {
  return req.authScope ?? 'tenant'
}

/** 요청에서 해석된 테넌트를 꺼낸다(가드 통과 후엔 항상 존재). */
export function tenantOf(req: TenantRequest): TenantRow {
  if (!req.tenant) {
    // 가드가 항상 채우므로 도달하지 않음 — 방어적.
    throw new Error('테넌트 컨텍스트가 없습니다(가드 누락?)')
  }
  return req.tenant
}

/**
 * 요청 Origin 이 테넌트 허용목록을 통과하는지 검사.
 * - corsOrigins 에 `*` 가 있으면 모두 허용
 * - Origin 헤더가 없으면(서버-사이드 호출·일부 동일 출처) 허용(브라우저만 Origin 을 강제하므로
 *   교차출처 공격 표면은 브라우저 Origin 검사로 충분히 막힌다)
 * - 그 외엔 정확히 일치하는 origin 이 있어야 허용
 */
export function isOriginAllowed(origin: string | undefined, corsOrigins: string[]): boolean {
  if (corsOrigins.includes('*')) return true
  if (!origin) return true
  return corsOrigins.includes(origin)
}
