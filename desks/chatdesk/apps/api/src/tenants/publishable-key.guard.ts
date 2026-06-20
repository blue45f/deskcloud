import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { TenantsService } from './tenants.service'

import type { AuthedRequest } from '../admin/admin-token.guard'
import type { Request } from 'express'

const KEY_HEADER = 'x-chat-key'

function headerValue(req: Request, name: string): string | undefined {
  const h = req.headers[name]
  return Array.isArray(h) ? h[0] : h
}

/**
 * publishable 키 게이트(브라우저용) — `X-Chat-Key: pk_…` 로 테넌트를 해석하고
 * Origin 이 테넌트 allowlist 를 통과하는지 검사한 뒤 req.tenant 에 부착.
 * 멤버십(요청 memberId 가 대화 멤버인지)은 컨트롤러/서비스가 별도로 강제한다.
 */
@Injectable()
export class PublishableKeyGuard implements CanActivate {
  constructor(private readonly tenants: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>()
    const pk = headerValue(req, KEY_HEADER)
    const tenant = await this.tenants.findByPublishableKey(pk)
    if (!tenant) {
      throw new UnauthorizedException('유효한 publishable 키(X-Chat-Key: pk_…)가 필요합니다')
    }
    const origin = headerValue(req, 'origin')
    if (!this.tenants.isOriginAllowed(tenant, origin)) {
      throw new UnauthorizedException(`Origin 이 허용되지 않습니다: ${origin ?? '(none)'}`)
    }
    req.tenant = tenant
    return true
  }
}
