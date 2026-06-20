import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { APP_CONFIG, type AppConfig } from '../config'

import type { Request } from 'express'

/**
 * 플랫폼 어드민 게이트 — `X-Admin-Token` 헤더가 ADMIN_TOKEN 과 일치해야 통과.
 * (테넌트 단위 secret 키와 별개로, 플랫폼 운영자가 횡단 작업을 할 때 쓰는 옵션 게이트.)
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>()
    const header = req.headers['x-admin-token']
    const token = Array.isArray(header) ? header[0] : header
    if (!token || token !== this.cfg.adminToken) {
      throw new UnauthorizedException('유효한 X-Admin-Token 헤더가 필요합니다')
    }
    return true
  }
}
