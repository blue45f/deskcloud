import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { TenantsService } from '../tenants/tenants.service'

import { isOriginAllowed, type TenantRequest } from './tenant-context'

function headerValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

/**
 * 공개(위젯) 가드 — publishable 키로 테넌트를 해석하고 Origin 허용목록을 검사한다.
 * 키: `x-pk` 헤더 또는 `?pk=` 쿼리. 잘못된 키면 401, Origin 불일치면 403.
 * 통과 시 req.tenant 에 테넌트를 실어 컨트롤러로 전달.
 */
@Injectable()
export class PublishableKeyGuard implements CanActivate {
  constructor(private readonly tenants: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<TenantRequest>()
    const pk =
      headerValue(req.headers['x-pk']) ??
      (typeof req.query.pk === 'string' ? req.query.pk : undefined)

    if (!pk) {
      throw new UnauthorizedException('publishable 키가 필요합니다 (x-pk 헤더 또는 ?pk=)')
    }

    const tenant = await this.tenants.findByPublishableKey(pk)
    if (!tenant) {
      throw new UnauthorizedException('유효하지 않은 publishable 키입니다')
    }

    const origin = headerValue(req.headers.origin)
    if (!isOriginAllowed(origin, tenant.corsOrigins ?? [])) {
      throw new ForbiddenException(`Origin '${origin ?? ''}' 이(가) 허용목록에 없습니다`)
    }

    req.tenant = tenant
    return true
  }
}
