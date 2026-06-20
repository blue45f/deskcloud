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
 * 모더레이션 검사 가드 — publishable **또는** secret 키로 테넌트를 해석한다.
 *   - `x-sk`(서버-사이드 호출): 키만 맞으면 통과(Origin 검사 안 함 — 서버는 Origin 을 안 보냄).
 *   - `x-pk` 또는 `?pk=`(브라우저/서버): 키 + Origin 허용목록 검사.
 * 검사(POST /moderate)는 브라우저(공개)와 서버(비밀) 양쪽에서 호출되므로 둘 다 허용한다.
 */
@Injectable()
export class ModerateAuthGuard implements CanActivate {
  constructor(private readonly tenants: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<TenantRequest>()

    // 우선순위 1: secret 키(서버-사이드). Origin 검사 생략.
    const sk = headerValue(req.headers['x-sk'])
    if (sk) {
      const tenant = await this.tenants.findBySecretKey(sk)
      if (!tenant) throw new UnauthorizedException('유효하지 않은 secret 키입니다')
      req.tenant = tenant
      return true
    }

    // 우선순위 2: publishable 키 + Origin 허용목록.
    const pk =
      headerValue(req.headers['x-pk']) ??
      (typeof req.query.pk === 'string' ? req.query.pk : undefined)
    if (!pk) {
      throw new UnauthorizedException('publishable(x-pk) 또는 secret(x-sk) 키가 필요합니다')
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
