import { isPublishableKey } from '@authdesk/shared'
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { isOriginAllowed } from './cors'
import { TENANT_CONTEXT_KEY, type TenantRecord } from './tenant.types'
import { TenantsService } from './tenants.service'

import type { Request } from 'express'

/**
 * publishable 키 게이트 — 공개(프론트 임베드) 경로용. `X-Authdesk-Key: pk_…` 헤더로 테넌트를
 * 해석하고, 요청 Origin 을 테넌트의 corsOrigins allowlist 로 검사한다.
 * 통과 시 TenantRecord 를 `req.authdeskTenant` 에 부착(컨트롤러가 꺼내 쓴다).
 */
@Injectable()
export class PublishableKeyGuard implements CanActivate {
  constructor(private readonly tenants: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>()
    const raw = req.headers['x-authdesk-key']
    const key = Array.isArray(raw) ? raw[0] : raw
    if (!key) throw new UnauthorizedException('X-Authdesk-Key: pk_… 헤더가 필요합니다')

    // 키 형태(pk_ 프리픽스)를 먼저 검사해 sk_/임의 문자열로 인한 불필요한 DB 조회를 막는다
    // (SecretKeyGuard 의 extractBearerSecretKey 와 동일한 프리픽스 규율).
    if (!isPublishableKey(key))
      throw new UnauthorizedException('유효하지 않은 publishable 키입니다')

    const tenant = await this.tenants.findByPublishableKey(key)
    if (!tenant) throw new UnauthorizedException('유효하지 않은 publishable 키입니다')

    // Origin allowlist 검사 — 브라우저 요청에 Origin 이 있으면 테넌트 allowlist 와 대조.
    const originHeader = req.headers['origin']
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader
    if (origin && !isOriginAllowed(origin, tenant.corsOrigins)) {
      throw new ForbiddenException(`origin '${origin}' 은 이 테넌트의 CORS allowlist 에 없습니다`)
    }

    ;(req as unknown as Record<string, TenantRecord>)[TENANT_CONTEXT_KEY] = tenant
    return true
  }
}
