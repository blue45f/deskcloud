import { isOriginAllowed, isPublishableKey } from '@mediadesk/shared'
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { TenantsService } from '../tenants/tenants.service'

import type { TenantRequest } from './request'
import type { Request } from 'express'

/**
 * 공개(브라우저) 엔드포인트 인증 — `X-Publishable-Key` 로 테넌트를 식별하고,
 * 그 테넌트의 CORS 허용목록에 요청 Origin 이 포함되는지 검사한다.
 *
 * - 키가 없거나 형식이 틀리거나 매칭 테넌트가 없으면 401.
 * - Origin 이 테넌트 허용목록에 없으면 403 (허용목록이 '*' 면 전체 허용).
 *   Origin 헤더가 아예 없으면(같은 출처/서버-투-서버) 통과시킨다 — 브라우저 CORS 는
 *   Origin 을 항상 싣지만, curl/SSR 등은 없을 수 있어 키만으로 인증한다.
 */
@Injectable()
export class PublishableAuthGuard implements CanActivate {
  constructor(private readonly tenants: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & TenantRequest>()
    const header = req.headers['x-publishable-key']
    const pk = (Array.isArray(header) ? header[0] : header)?.trim()

    if (!pk || !isPublishableKey(pk)) {
      throw new UnauthorizedException('유효한 X-Publishable-Key 헤더가 필요합니다')
    }
    const tenant = await this.tenants.findByPublishableKey(pk)
    if (!tenant) {
      throw new UnauthorizedException('알 수 없는 publishable 키입니다')
    }

    const origin = req.headers.origin
    if (origin && !isOriginAllowed(tenant.corsOrigins ?? [], origin)) {
      throw new ForbiddenException(`이 origin 은 허용되지 않았습니다: ${origin}`)
    }

    req.tenant = tenant
    return true
  }
}
