import { timingSafeEqual } from 'node:crypto'

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import {
  ADMIN_CONTEXT_KEY,
  CORE_OPTIONS,
  type AdminAccount,
  type AdminScope,
  type AuthenticatedAdminAccount,
  type CoreOptions,
} from './tokens'

interface AdminRequest {
  headers: Record<string, unknown>
  params?: Record<string, unknown>
  [ADMIN_CONTEXT_KEY]?: AuthenticatedAdminAccount
}

/**
 * 토큰 계정이 라우트의 appId 를 관리할 수 있는지 검사.
 * account.appIds 가 비어있으면 전역(모든 앱). 있으면 라우트 appId(소문자) 가 포함돼야 한다.
 * appId 라우트가 아닌데 appIds 제한이 있으면(=앱 스코프 토큰의 비앱 라우트 접근) 거부한다.
 */
function isAppAllowed(account: AdminAccount, appIdParam: unknown): boolean {
  const allow = account.appIds
  if (!allow || allow.length === 0) return true
  const appId = typeof appIdParam === 'string' ? appIdParam.trim().toLowerCase() : ''
  return appId.length > 0 && allow.includes(appId)
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function legacyAdminAccount(token: string): AdminAccount {
  return {
    id: 'legacy-admin',
    label: 'Legacy Admin Token',
    role: 'owner',
    scopes: ['admin:*'],
    token,
  }
}

function hasRequiredScope(account: AdminAccount, requiredScopes: readonly AdminScope[]): boolean {
  if (requiredScopes.length === 0) return true
  if (account.scopes.includes('admin:*')) return true
  return requiredScopes.every((scope) => account.scopes.includes(scope))
}

/**
 * 어드민 게이트 — `X-Admin-Token` 헤더가 운영자별 토큰 또는 legacy adminToken 과 일치해야 통과.
 * 모든 Desk가 어드민 경로에 공통으로 쓰는 가드(@desk/core/nest 에서 import).
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  protected readonly requiredScopes: readonly AdminScope[] = []

  constructor(@Inject(CORE_OPTIONS) private readonly options: CoreOptions) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AdminRequest>()
    const header = req.headers['x-admin-token']
    const token = Array.isArray(header) ? String(header[0]) : (header as string | undefined)
    const accounts = [
      ...(this.options.adminAccounts ?? []),
      ...(this.options.adminToken ? [legacyAdminAccount(this.options.adminToken)] : []),
    ]
    const account = token
      ? accounts.find((candidate) => constantTimeEqual(token, candidate.token))
      : undefined
    if (!account) {
      throw new UnauthorizedException('유효한 X-Admin-Token 헤더가 필요합니다')
    }
    if (!hasRequiredScope(account, this.requiredScopes)) {
      throw new ForbiddenException('요청한 어드민 작업 권한이 없습니다')
    }
    if (!isAppAllowed(account, req.params?.appId)) {
      throw new ForbiddenException('이 앱에 대한 어드민 권한이 없습니다')
    }
    const { token: _token, ...safeAccount } = account
    req[ADMIN_CONTEXT_KEY] = safeAccount
    return true
  }
}
