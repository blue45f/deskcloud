import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { headerValue, type AuthedRequest } from './request-context'
import { TenantContextService } from './tenant-context.service'

/**
 * 어드민 가드 — 두 경로 중 하나면 통과:
 *  1) 테넌트 시크릿 키: 헤더 `x-sk` (sk_…) → 해당 테넌트의 어드민 컨텍스트
 *  2) 글로벌 셀프호스트 토큰: 헤더 `X-Admin-Token` === ADMIN_TOKEN → 테넌트 비종속
 *
 * admin-token 경로는 어떤 테넌트도 조작할 수 있으므로(셀프호스트 운영자),
 * 컨트롤러가 대상 테넌트를 별도로 지정(헤더 x-sk 우선, 없으면 라우트/쿼리)할 수 있게 한다.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly tenants: TenantContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>()

    const sk = headerValue(req, 'x-sk')
    if (sk) {
      const tenant = await this.tenants.resolveSecretKey(sk)
      if (!tenant) throw new UnauthorizedException('유효하지 않은 시크릿 키입니다')
      req.authContext = { tenant, via: 'secret-key' }
      return true
    }

    const adminToken = headerValue(req, 'x-admin-token')
    if (this.tenants.matchesAdminToken(adminToken)) {
      req.authContext = { tenant: null, via: 'admin-token' }
      return true
    }

    throw new UnauthorizedException(
      '어드민 인증이 필요합니다 (헤더 x-sk 시크릿 키 또는 X-Admin-Token)'
    )
  }
}
