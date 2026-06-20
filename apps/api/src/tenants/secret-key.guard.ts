import { extractBearerSecretKey } from '@authdesk/shared'
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { TENANT_CONTEXT_KEY, type TenantRecord } from './tenant.types'
import { TenantsService } from './tenants.service'

import type { Request } from 'express'

/**
 * secret 키 게이트 — `Authorization: Bearer sk_…` 를 해시 매칭으로 인증한다.
 * 통과 시 인증된 TenantRecord 를 `req.authdeskTenant` 에 부착(컨트롤러가 @Req 로 꺼내 쓴다).
 * 어드민(사용자 목록·통계)·서버-서버(테넌트 본인) 경로에 사용.
 */
@Injectable()
export class SecretKeyGuard implements CanActivate {
  constructor(private readonly tenants: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>()
    const auth = req.headers['authorization']
    const key = extractBearerSecretKey(Array.isArray(auth) ? auth[0] : auth)
    if (!key) throw new UnauthorizedException('Authorization: Bearer sk_… 헤더가 필요합니다')

    const tenant = await this.tenants.authenticateBySecretKey(key)
    if (!tenant) throw new UnauthorizedException('유효하지 않은 secret 키입니다')

    ;(req as unknown as Record<string, TenantRecord>)[TENANT_CONTEXT_KEY] = tenant
    return true
  }
}

/** SecretKeyGuard/PublishableKeyGuard 가 부착한 인증 테넌트를 req 에서 꺼낸다. */
export function tenantOf(req: Request): TenantRecord {
  const tenant = (req as unknown as Record<string, TenantRecord | undefined>)[TENANT_CONTEXT_KEY]
  // 가드(SecretKey/Publishable)를 통과한 라우트에서만 호출되므로 항상 부착돼 있다.
  if (!tenant) throw new UnauthorizedException('테넌트 인증 컨텍스트가 없습니다')
  return tenant
}
