import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { ApiKeyContext, AuthUser } from '../common/request-context'
import type { ApiKeyScope, Permission } from '@termsdesk/shared'
import type { Request } from 'express'

export const PERMISSION_KEY = 'td:permission'
export const SCOPE_KEY = 'td:scope'

/** 대시보드 엔드포인트에 필요한 권한(역할 기반). */
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION_KEY, permission)

/** 공개(API 키) 엔드포인트에 필요한 스코프. */
export const RequireScope = (scope: ApiKeyScope) => SetMetadata(SCOPE_KEY, scope)

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<Request>()
    return req.authUser as AuthUser
  }
)

export const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyContext => {
    const req = ctx.switchToHttp().getRequest<Request>()
    return req.apiKey as ApiKeyContext
  }
)

export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request>()
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0]!.trim()
  return req.ip ?? 'unknown'
})
