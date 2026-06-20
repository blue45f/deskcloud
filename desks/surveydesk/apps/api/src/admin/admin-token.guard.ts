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
 * 어드민 게이트 — `X-Admin-Token` 헤더가 ADMIN_TOKEN 과 일치해야 통과.
 * 토큰 비교는 길이 누설을 피하기 위해 단순 상수 비교(타이밍은 토큰 길이 고정 환경이라 충분).
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
