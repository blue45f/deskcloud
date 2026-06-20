import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { isSecretKey } from '@notifydesk/shared'

import { APP_CONFIG, type AppConfig } from '../config'

import { extractKey, type AuthedRequest } from './tenant-context'
import { TenantsService } from './tenants.service'

import type { Request } from 'express'

/**
 * 서버/어드민 경로 가드 — secret 키(sk_) 또는 플랫폼 ADMIN_TOKEN.
 *
 * 두 경로:
 * 1) Authorization: Bearer sk_… → 해당 테넌트로 인증(via='secret').
 * 2) X-Admin-Token: <ADMIN_TOKEN> → 플랫폼 어드민. 이 경우 대상 테넌트는
 *    경로 파라미터(:tenantId)/쿼리(tenantId)로 지정해야 한다(via='admin').
 *
 * 어느 쪽도 없으면 401.
 */
@Injectable()
export class SecretKeyGuard implements CanActivate {
  constructor(
    private readonly tenants: TenantsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>()

    // 1) 플랫폼 어드민 토큰 경로
    const adminToken = this.headerValue(req, 'x-admin-token')
    if (adminToken) {
      if (adminToken !== this.cfg.adminToken) {
        throw new UnauthorizedException('유효하지 않은 X-Admin-Token 입니다')
      }
      const tenantId = this.resolveTenantId(req)
      const tenant = await this.tenants.getById(tenantId)
      req.tenantCtx = { tenant, via: 'admin' }
      return true
    }

    // 2) secret 키 경로
    const key = extractKey(req)
    if (!key) {
      throw new UnauthorizedException(
        'secret 키(Authorization: Bearer sk_…) 또는 X-Admin-Token 이 필요합니다'
      )
    }
    if (!isSecretKey(key)) {
      throw new UnauthorizedException('이 경로에는 secret(sk_) 키만 사용할 수 있습니다')
    }
    const tenant = await this.tenants.findBySecretKey(key)
    if (!tenant) {
      throw new UnauthorizedException('유효하지 않은 secret 키입니다')
    }
    req.tenantCtx = { tenant, via: 'secret' }
    return true
  }

  private headerValue(req: Request, name: string): string | undefined {
    const h = req.headers[name]
    const v = Array.isArray(h) ? h[0] : h
    return v?.trim() || undefined
  }

  /** 어드민 토큰 경로의 대상 테넌트 — :tenantId 파라미터 우선, 없으면 쿼리. */
  private resolveTenantId(req: Request): string {
    const params = req.params as Record<string, string | undefined>
    const query = req.query as Record<string, unknown>
    const fromParam = params.tenantId
    const fromQuery = typeof query.tenantId === 'string' ? query.tenantId : undefined
    const tenantId = fromParam ?? fromQuery
    if (!tenantId) {
      throw new UnauthorizedException(
        'X-Admin-Token 사용 시 대상 테넌트(:tenantId 경로 또는 ?tenantId 쿼리)가 필요합니다'
      )
    }
    return tenantId
  }
}
