import type { AdminAuthKind, TenantRow } from './tenant-context.service'
import type { Request } from 'express'

/**
 * 가드가 검증 후 요청에 심는 인증 컨텍스트.
 * 컨트롤러는 @Req() 로 꺼내 쓰거나, 아래 헬퍼/데코레이터로 접근한다.
 */
export interface AuthContext {
  tenant: TenantRow | null
  /** 'publishable' | 'admin-token' | 'secret-key' */
  via: 'publishable' | AdminAuthKind
}

export interface AuthedRequest extends Request {
  authContext?: AuthContext
}

/** 요청에서 인증 컨텍스트를 꺼낸다(가드 통과 보장 시). */
export function getAuth(req: AuthedRequest): AuthContext {
  const ctx = req.authContext
  if (!ctx) throw new Error('AuthContext 가 없습니다 — 가드가 적용되지 않았습니다')
  return ctx
}

/** 헤더 값 1개를 안전하게 추출(배열/소문자 처리). */
export function headerValue(req: Request, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()]
  return Array.isArray(v) ? v[0] : v
}
