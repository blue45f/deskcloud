import { extractBearerKey } from '@desk/shared'
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { TENANT_CONTEXT_KEY, TENANT_SERVICE } from './tokens'

import type { TenantService } from '../tenant-service'

/**
 * secret 키 게이트 — `Authorization: Bearer sk_…` 를 해시 매칭으로 인증한다.
 * 통과 시 인증된 TenantRecord 를 `req.deskTenant` 에 부착(컨트롤러가 @Req 로 꺼내 쓴다).
 * 서버-서버(테넌트 본인) 경로에 사용. Desk가 자기 백엔드 인증에 그대로 재사용 가능.
 */
@Injectable()
export class SecretKeyGuard implements CanActivate {
  constructor(@Inject(TENANT_SERVICE) private readonly tenants: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, unknown>
      [TENANT_CONTEXT_KEY]?: unknown
    }>()
    const auth = req.headers['authorization']
    const key = extractBearerKey(
      Array.isArray(auth) ? String(auth[0]) : (auth as string | undefined)
    )
    if (!key) throw new UnauthorizedException('Authorization: Bearer sk_… 헤더가 필요합니다')

    const tenant = await this.tenants.authenticateBySecretKey(key)
    if (!tenant) throw new UnauthorizedException('유효하지 않은 secret 키입니다')

    req[TENANT_CONTEXT_KEY] = tenant
    return true
  }
}
