import type { tenants } from '../db/schema'
import type { Request } from 'express'

export type TenantRow = typeof tenants.$inferSelect

/** 가드가 인증 후 요청에 부착하는 컨텍스트. */
export interface TenantContext {
  tenant: TenantRow
  /** 인증 방식 — publishable 키 · secret 키 · 플랫폼 어드민 토큰. */
  via: 'publishable' | 'secret' | 'admin'
}

/** TenantContext 가 부착된 요청. */
export interface AuthedRequest extends Request {
  tenantCtx?: TenantContext
}

/** 컨트롤러에서 인증된 테넌트를 꺼낸다(가드 통과가 보장). */
export function getTenantCtx(req: AuthedRequest): TenantContext {
  if (!req.tenantCtx) {
    throw new Error('TenantContext 미설정 — 가드 적용 누락')
  }
  return req.tenantCtx
}

/** 요청에서 베어러/헤더 키를 추출한다(Authorization: Bearer … 또는 X-Api-Key). */
export function extractKey(req: Request): string | null {
  const auth = req.headers.authorization
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim() || null
  }
  const header = req.headers['x-api-key']
  const key = Array.isArray(header) ? header[0] : header
  return key?.trim() || null
}

/**
 * 요청의 Origin 이 테넌트 CORS 허용목록에 부합하는지 검사.
 * '*' 면 전체 허용. Origin 헤더가 없으면(서버-서버/curl) 허용(브라우저만 Origin 을 보냄).
 */
export function originAllowed(corsOrigins: string[], origin: string | undefined): boolean {
  if (corsOrigins.includes('*')) return true
  if (!origin) return true // 비브라우저 컨텍스트(Origin 없음) — 통과
  return corsOrigins.includes(origin)
}
