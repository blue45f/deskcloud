import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { CORE_OPTIONS, type CoreOptions } from './tokens'

/**
 * 어드민 게이트 — `X-Admin-Token` 헤더가 CoreOptions.adminToken 과 일치해야 통과.
 * 모든 Desk가 어드민 경로에 공통으로 쓰는 가드(@desk/core/nest 에서 import).
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(@Inject(CORE_OPTIONS) private readonly options: CoreOptions) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>()
    const header = req.headers['x-admin-token']
    const token = Array.isArray(header) ? String(header[0]) : (header as string | undefined)
    if (!token || token !== this.options.adminToken) {
      throw new UnauthorizedException('유효한 X-Admin-Token 헤더가 필요합니다')
    }
    return true
  }
}
