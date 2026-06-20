import { isSecretKey } from '@mediadesk/shared'
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

import type { TenantRequest } from './request'
import type { Request } from 'express'

function headerValue(req: Request, name: string): string | undefined {
  const v = req.headers[name]
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined
}

/**
 * 어드민 엔드포인트 인증 — 두 경로 중 하나:
 *   1) `X-Sk`: 테넌트 secret 키(sk_). 그 키의 테넌트만 관리.
 *   2) `X-Admin-Token`: 마스터 토큰(ADMIN_TOKEN). 어떤 테넌트든 관리 — 대상은
 *      `X-Tenant-Id` 헤더(또는 :tenantId 라우트 파라미터)로 지정하고, 없으면 단일 테넌트.
 *
 * 해석된 테넌트를 req.tenant 에 붙인다(컨트롤러/서비스가 사용).
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly tenants: TenantsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & TenantRequest>()

    // (1) 테넌트 secret 키
    const sk = headerValue(req, 'x-sk')
    if (sk) {
      if (!isSecretKey(sk)) throw new UnauthorizedException('secret 키 형식이 올바르지 않습니다')
      const tenant = await this.tenants.findBySecretKey(sk)
      if (!tenant) throw new UnauthorizedException('알 수 없는 secret 키입니다')
      req.tenant = tenant
      return true
    }

    // (2) 마스터 어드민 토큰
    const adminToken = headerValue(req, 'x-admin-token')
    if (adminToken) {
      if (adminToken !== this.cfg.adminToken) {
        throw new UnauthorizedException('어드민 토큰이 올바르지 않습니다')
      }
      req.isAdminMaster = true
      const targetId =
        headerValue(req, 'x-tenant-id') ??
        (typeof req.params?.tenantId === 'string' ? req.params.tenantId : undefined)

      if (targetId) {
        const tenant = await this.tenants.findById(targetId)
        if (!tenant) throw new NotFoundException('대상 테넌트를 찾을 수 없습니다')
        req.tenant = tenant
        return true
      }
      // 단일 테넌트면 그것을, 여러 개인데 미지정이면 목록 엔드포인트만 허용(테넌트 없이 통과).
      const rows = await this.tenants.listTenants()
      if (rows.length === 1) {
        const only = await this.tenants.findById(rows[0]!.id)
        if (only) req.tenant = only
      }
      return true
    }

    throw new UnauthorizedException('X-Sk(테넌트 secret) 또는 X-Admin-Token 헤더가 필요합니다')
  }
}
