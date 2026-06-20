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
 * pk **또는** sk 게이트 — `X-Chat-Key` 가 pk 면 Origin allowlist 도 검사, sk 면 서버 호출로 통과.
 * 대화 생성처럼 브라우저(pk)·서버(sk) 양쪽이 부를 수 있는 라우트에 사용. req.tenant 부착.
 */
@Injectable()
export class AnyKeyGuard implements CanActivate {
  constructor(private readonly tenants: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>()
    const key = headerValue(req, KEY_HEADER)

    // sk 우선(서버 호출) — Origin 검사 없음.
    const bySk = await this.tenants.findBySecretKey(key)
    if (bySk) {
      req.tenant = bySk
      return true
    }

    // pk(브라우저) — Origin allowlist 검사.
    const byPk = await this.tenants.findByPublishableKey(key)
    if (byPk) {
      const origin = headerValue(req, 'origin')
      if (!this.tenants.isOriginAllowed(byPk, origin)) {
        throw new UnauthorizedException(`Origin 이 허용되지 않습니다: ${origin ?? '(none)'}`)
      }
      req.tenant = byPk
      return true
    }

    throw new UnauthorizedException('유효한 X-Chat-Key(pk_ 또는 sk_)가 필요합니다')
  }
}
