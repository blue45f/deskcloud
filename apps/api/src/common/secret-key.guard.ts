import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'

import { APP_CONFIG, type AppConfig } from '../config'
import { TenantsService } from '../tenants/tenants.service'

import { timingSafeEqualStr } from './keys'

import type { TenantRequest } from './tenant-context'

function headerValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

/**
 * 어드민 가드 — 다음 중 하나로 테넌트 컨텍스트를 확정한다:
 *   1) `x-sk` 헤더(테넌트 secret 키) → 그 테넌트로 스코프
 *   2) `X-Admin-Token` 헤더(글로벌 ADMIN_TOKEN, 셀프호스트) → 모든 테넌트 접근.
 *      이 경우 대상 테넌트를 `x-tenant-id` / `?tenantId=` / `x-pk` 중 하나로 지정해야 함.
 * 통과 시 req.tenant 에 대상 테넌트를 실어 컨트롤러로 전달.
 */
@Injectable()
export class SecretKeyGuard implements CanActivate {
  constructor(
    private readonly tenants: TenantsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<TenantRequest>()

    // 1) 테넌트 secret 키
    const sk = headerValue(req.headers['x-sk'])
    if (sk) {
      const tenant = await this.tenants.findBySecretKey(sk)
      if (!tenant) throw new UnauthorizedException('유효하지 않은 secret 키입니다')
      req.tenant = tenant
      return true
    }

    // 2) 글로벌 어드민 토큰 + 대상 테넌트 지정
    // 가장 권한 높은(모든 테넌트) 자격증명이므로 평문 `===` 가 아닌 타이밍 세이프 비교로 확인한다.
    const adminToken = headerValue(req.headers['x-admin-token'])
    if (adminToken && timingSafeEqualStr(adminToken, this.cfg.adminToken)) {
      const tenant = await this.resolveTargetTenant(req)
      if (!tenant) {
        throw new NotFoundException(
          '대상 테넌트를 지정하세요 (x-tenant-id / ?tenantId= / x-pk 중 하나)'
        )
      }
      req.tenant = tenant
      return true
    }

    throw new UnauthorizedException('secret 키(x-sk) 또는 글로벌 X-Admin-Token 이 필요합니다')
  }

  /** 글로벌 토큰 사용 시 대상 테넌트 해석. */
  private async resolveTargetTenant(req: TenantRequest): Promise<TenantRequest['tenant']> {
    const tenantId =
      headerValue(req.headers['x-tenant-id']) ??
      (typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined)
    if (tenantId) return (await this.tenants.findById(tenantId)) ?? undefined

    const pk =
      headerValue(req.headers['x-pk']) ??
      (typeof req.query.pk === 'string' ? req.query.pk : undefined)
    if (pk) return (await this.tenants.findByPublishableKey(pk)) ?? undefined

    return undefined
  }
}
