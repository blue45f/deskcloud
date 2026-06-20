import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { getAuth, headerValue, type AuthedRequest } from './request-context'
import { TenantContextService } from './tenant-context.service'

/**
 * 공개(위젯) 가드 — 퍼블리시 키 + Origin 검사.
 *  - 키는 헤더 `x-pk` 또는 쿼리 `?pk=` 로 받는다.
 *  - 키가 없거나 매칭 테넌트가 없으면 401.
 *  - Origin 헤더가 테넌트 corsOrigins 화이트리스트에 없으면 403(와일드카드 '*' 면 통과).
 * 통과 시 req.authContext 에 { tenant, via:'publishable' } 를 심는다.
 */
@Injectable()
export class PublishableKeyGuard implements CanActivate {
  constructor(private readonly tenants: TenantContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>()

    const pk =
      headerValue(req, 'x-pk') ?? (typeof req.query.pk === 'string' ? req.query.pk : undefined)
    if (!pk) {
      throw new UnauthorizedException('퍼블리시 키가 필요합니다 (헤더 x-pk 또는 쿼리 ?pk=)')
    }

    const tenant = await this.tenants.findByPublishableKey(pk)
    if (!tenant) {
      throw new UnauthorizedException('유효하지 않은 퍼블리시 키입니다')
    }

    const origin = headerValue(req, 'origin')
    if (!this.tenants.isOriginAllowed(tenant, origin)) {
      throw new ForbiddenException(
        `Origin '${origin ?? '(없음)'}' 은 이 테넌트의 허용 목록에 없습니다`
      )
    }

    req.authContext = { tenant, via: 'publishable' }
    return true
  }
}

/** 가드 통과 후 컨트롤러에서 테넌트를 꺼내는 헬퍼. */
export function tenantOf(req: AuthedRequest): NonNullable<ReturnType<typeof getAuth>['tenant']> {
  const t = getAuth(req).tenant
  if (!t) throw new UnauthorizedException('테넌트 컨텍스트가 없습니다')
  return t
}
