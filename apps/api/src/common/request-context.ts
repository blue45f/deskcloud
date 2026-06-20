import type { Role } from '@termsdesk/shared'

/** 세션(쿠키 JWT)으로 인증된 대시보드 사용자. */
export interface AuthUser {
  userId: string
  orgId: string
  role: Role
  name: string
  email: string
}

/** API 키(Bearer)로 인증된 공개 엔드포인트 컨텍스트. */
export interface ApiKeyContext {
  keyId: string
  orgId: string
  scopes: string[]
}

declare module 'express' {
  interface Request {
    authUser?: AuthUser
    apiKey?: ApiKeyContext
  }
}
