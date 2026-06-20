import { extractBearerToken } from '@authdesk/shared'
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { AuthService } from './auth.service'
import { END_USER_CONTEXT_KEY, type EndUserContext } from './end-user.types'

import type { Request } from 'express'

/**
 * end-user 세션 게이트 — `Authorization: Bearer <end-user JWT>` 를 검증한다.
 * JWT 서명·만료 + sessions 테이블의 jti 생존(미revoke·미만료)을 확인하고, 통과하면
 * 인증 컨텍스트를 `req.authdeskEndUser` 에 부착한다(`/auth/me`·`/auth/logout` 보호).
 *
 * 주: 이 토큰은 테넌트 키(pk_/sk_)가 아니라 end-user 세션 JWT 다(혼동 주의).
 */
@Injectable()
export class EndUserGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>()
    const header = req.headers['authorization']
    const token = extractBearerToken(Array.isArray(header) ? header[0] : header)
    if (!token) throw new UnauthorizedException('Authorization: Bearer <토큰> 헤더가 필요합니다')

    const ctx = await this.auth.authenticate(token)
    if (!ctx) throw new UnauthorizedException('세션이 유효하지 않거나 만료되었습니다')

    ;(req as unknown as Record<string, EndUserContext>)[END_USER_CONTEXT_KEY] = ctx
    return true
  }
}

/** EndUserGuard 가 부착한 인증 컨텍스트를 req 에서 꺼낸다. */
export function endUserOf(req: Request): EndUserContext {
  const ctx = (req as unknown as Record<string, EndUserContext | undefined>)[END_USER_CONTEXT_KEY]
  // EndUserGuard 를 통과한 라우트에서만 호출되므로 항상 부착돼 있다.
  if (!ctx) throw new UnauthorizedException('인증 컨텍스트가 없습니다')
  return ctx
}
