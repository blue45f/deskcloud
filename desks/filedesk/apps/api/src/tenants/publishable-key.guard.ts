import { isPublishableKey } from '@filedesk/shared'
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { extractKey, originAllowed, type AuthedRequest } from './tenant-context'
import { TenantsService } from './tenants.service'

/**
 * 공개(브라우저) 경로 가드 — publishable 키(pk_) + Origin 검사.
 *
 * - Authorization: Bearer pk_… (또는 X-Api-Key: pk_…) 로 테넌트를 식별.
 * - 키 형식이 pk_ 가 아니면 401(secret 키를 브라우저에 쓰지 못하게 차단).
 * - 알 수 없는 키면 401.
 * - 요청 Origin 이 테넌트 CORS 허용목록에 없으면 403(테넌트별 격리).
 */
@Injectable()
export class PublishableKeyGuard implements CanActivate {
  constructor(private readonly tenants: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>()
    const key = extractKey(req)
    if (!key) {
      throw new UnauthorizedException('publishable 키가 필요합니다 (Authorization: Bearer pk_…)')
    }
    if (!isPublishableKey(key)) {
      throw new UnauthorizedException('이 경로에는 publishable(pk_) 키만 사용할 수 있습니다')
    }

    const tenant = await this.tenants.findByPublishableKey(key)
    if (!tenant) {
      throw new UnauthorizedException('유효하지 않은 publishable 키입니다')
    }

    const origin = req.headers.origin
    if (!originAllowed(tenant.corsOrigins, origin)) {
      throw new ForbiddenException(`Origin '${origin}' 은(는) 이 테넌트에 허용되지 않습니다`)
    }

    req.tenantCtx = { tenant, via: 'publishable' }
    return true
  }
}
