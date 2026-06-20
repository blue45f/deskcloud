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
 * secret 키 게이트(서버 전용) — `X-Chat-Key: sk_…` 로 테넌트를 해석해 req.tenant 에 부착.
 * 멤버 토큰 발급처럼 sk 가 반드시 필요한 라우트에 사용.
 */
@Injectable()
export class SecretKeyGuard implements CanActivate {
  constructor(private readonly tenants: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>()
    const sk = headerValue(req, KEY_HEADER)
    const tenant = await this.tenants.findBySecretKey(sk)
    if (!tenant) {
      throw new UnauthorizedException('유효한 secret 키(X-Chat-Key: sk_…)가 필요합니다')
    }
    req.tenant = tenant
    return true
  }
}
