import type { EndUserDto } from '@authdesk/shared'

/** EndUserGuard 가 인증된 end-user 클레임을 부착하는 req 키. */
export const END_USER_CONTEXT_KEY = 'authdeskEndUser'

/** 인증된 end-user 컨텍스트 — 토큰에서 검증한 세션·사용자·테넌트 식별자. */
export interface EndUserContext {
  /** 세션 id(jti). */
  sessionId: string
  /** end-user id. */
  userId: string
  /** 테넌트 id. */
  tenantId: string
}

/** end_users 행에서 만든 도메인 레코드(passwordHash 보유 — 절대 DTO 로 새지 않게 분리). */
export interface EndUserRecord {
  id: string
  tenantId: string
  email: string
  passwordHash: string
  name: string
  verified: boolean
  createdAt: Date
  lastLoginAt: Date | null
}

/** 도메인 레코드 → 공개 DTO(passwordHash 제외). */
export function toEndUserDto(rec: EndUserRecord): EndUserDto {
  return {
    id: rec.id,
    email: rec.email,
    name: rec.name,
    verified: rec.verified,
    createdAt: rec.createdAt.toISOString(),
  }
}
