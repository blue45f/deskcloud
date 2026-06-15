import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { TenantRecord } from '../ports'

import { TENANT_CONTEXT_KEY } from './tokens'

/**
 * `@CurrentTenant()` — SecretKeyGuard/PublishableKeyGuard 가 부착한 인증 테넌트를 꺼낸다.
 * 가드 뒤의 핸들러에서만 의미가 있다(없으면 undefined).
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantRecord | undefined => {
    const req = ctx.switchToHttp().getRequest<Record<string, unknown>>()
    return req[TENANT_CONTEXT_KEY] as TenantRecord | undefined
  }
)
