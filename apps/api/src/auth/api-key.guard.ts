import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { eq } from 'drizzle-orm'

import { hashApiKey } from '../common/crypto'
import { PlanService } from '../common/plan.service'
import { DatabaseService } from '../db/database.service'
import { apiKeys } from '../db/schema'

import { SCOPE_KEY } from './decorators'

import type { ApiKeyScope } from '@termsdesk/shared'
import type { Request } from 'express'

/** Authorization: Bearer <api key> 검증 → req.apiKey 주입 + 스코프 검사 + 월 사용량 미터링. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly reflector: Reflector,
    private readonly plans: PlanService
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>()
    const header = req.headers['authorization']
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('API 키가 필요합니다 (Authorization: Bearer)')
    }
    const full = header.slice(7).trim()
    const rows = await this.dbs.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, hashApiKey(full)))
      .limit(1)
    const key = rows[0]
    if (!key || key.revokedAt) throw new UnauthorizedException('유효하지 않은 API 키입니다')

    const scopes = key.scopes.split(',').filter(Boolean)
    req.apiKey = { keyId: key.id, orgId: key.orgId, scopes }

    const required = this.reflector.getAllAndOverride<ApiKeyScope | undefined>(SCOPE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (required && !scopes.includes(required)) {
      throw new ForbiddenException(`이 API 키에는 '${required}' 스코프가 없습니다`)
    }

    // 플랜 월 호출 미터링 — 인증·스코프를 통과한 호출만 카운트, 한도 소진 시 429.
    await this.plans.meterApiCall(key.orgId)

    // last_used 갱신(베스트에포트)
    void this.dbs.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id))
      .catch(() => undefined)

    return true
  }
}
