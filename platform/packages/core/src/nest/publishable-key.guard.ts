import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { isOriginAllowed } from '../cors'

import { TENANT_CONTEXT_KEY, TENANT_SERVICE } from './tokens'

import type { TenantService } from '../tenant-service'

/**
 * publishable 키 게이트 — 공개(프론트 임베드) 경로용. `X-Desk-Key: pk_…` 헤더로 테넌트를
 * 해석하고, 요청 Origin 을 테넌트의 corsOrigins allowlist 로 검사한다.
 * 통과 시 TenantRecord 를 `req.deskTenant` 에 부착. (Desk의 공개 위젯 수집 경로에 재사용.)
 */
@Injectable()
export class PublishableKeyGuard implements CanActivate {
  constructor(@Inject(TENANT_SERVICE) private readonly tenants: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, unknown>
      [TENANT_CONTEXT_KEY]?: unknown
    }>()
    const raw = req.headers['x-desk-key']
    const key = Array.isArray(raw) ? String(raw[0]) : (raw as string | undefined)
    if (!key) throw new UnauthorizedException('X-Desk-Key: pk_… 헤더가 필요합니다')

    const tenant = await this.tenants.findByPublishableKey(key)
    if (!tenant) throw new UnauthorizedException('유효하지 않은 publishable 키입니다')

    // Origin allowlist 검사 — 브라우저 요청에 Origin 이 있으면 테넌트 allowlist 와 대조.
    const originHeader = req.headers['origin']
    const origin = Array.isArray(originHeader)
      ? String(originHeader[0])
      : (originHeader as string | undefined)
    if (origin && !isOriginAllowed(origin, tenant.corsOrigins)) {
      throw new ForbiddenException(`origin '${origin}' 은 이 테넌트의 CORS allowlist 에 없습니다`)
    }

    req[TENANT_CONTEXT_KEY] = tenant
    return true
  }
}
