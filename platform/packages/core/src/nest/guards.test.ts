import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { beforeEach, describe, expect, it } from 'vitest'

import { InMemoryTenantStore } from '../memory-stores'
import { TenantService } from '../tenant-service'

import { AdminTokenGuard } from './admin-token.guard'
import { PublishableKeyGuard } from './publishable-key.guard'
import { SecretKeyGuard } from './secret-key.guard'
import { ADMIN_CONTEXT_KEY, TENANT_CONTEXT_KEY } from './tokens'

import type { ExecutionContext } from '@nestjs/common'

/** 최소 ExecutionContext 목 — switchToHttp().getRequest() 만 제공. */
function ctxOf(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext
}

describe('AdminTokenGuard', () => {
  const guard = new AdminTokenGuard({ adminToken: 'secret-admin' })

  it('일치하면 통과', () => {
    expect(guard.canActivate(ctxOf({ headers: { 'x-admin-token': 'secret-admin' } }))).toBe(true)
  })

  it('불일치/누락이면 401', () => {
    expect(() => guard.canActivate(ctxOf({ headers: { 'x-admin-token': 'wrong' } }))).toThrow(
      UnauthorizedException
    )
    expect(() => guard.canActivate(ctxOf({ headers: {} }))).toThrow(UnauthorizedException)
  })

  it('운영자별 토큰이면 request 에 안전한 계정 정보를 부착', () => {
    const accountGuard = new AdminTokenGuard({
      adminToken: 'legacy',
      adminAccounts: [
        {
          id: 'support',
          label: 'Support Desk',
          role: 'support',
          scopes: ['inquiries:read'],
          token: 'support-token',
        },
      ],
    })
    const req: Record<string, unknown> = { headers: { 'x-admin-token': 'support-token' } }

    expect(accountGuard.canActivate(ctxOf(req))).toBe(true)
    expect(req[ADMIN_CONTEXT_KEY]).toEqual({
      id: 'support',
      label: 'Support Desk',
      role: 'support',
      scopes: ['inquiries:read'],
    })
  })

  it('필요 scope 가 없으면 403, owner(admin:*)는 통과', () => {
    class ScopedAdminTokenGuard extends AdminTokenGuard {
      protected override readonly requiredScopes = ['inquiries:read', 'inquiries:write'] as const
    }
    const scopedGuard = new ScopedAdminTokenGuard({
      adminToken: '',
      adminAccounts: [
        {
          id: 'auditor',
          label: 'Audit Viewer',
          role: 'auditor',
          scopes: ['inquiries:read'],
          token: 'auditor-token',
        },
        {
          id: 'owner',
          label: 'Owner',
          role: 'owner',
          scopes: ['admin:*'],
          token: 'owner-token',
        },
      ],
    })

    expect(() =>
      scopedGuard.canActivate(ctxOf({ headers: { 'x-admin-token': 'auditor-token' } }))
    ).toThrow(ForbiddenException)
    expect(scopedGuard.canActivate(ctxOf({ headers: { 'x-admin-token': 'owner-token' } }))).toBe(
      true
    )
  })

  it('appIds 스코프 토큰은 허용된 앱만 통과(다른 앱은 403, 전역 토큰은 모든 앱)', () => {
    const appGuard = new AdminTokenGuard({
      adminToken: 'legacy',
      adminAccounts: [
        {
          id: 'picky-ops',
          label: 'Picky Ops',
          role: 'operator',
          scopes: ['inquiries:read', 'inquiries:write'],
          token: 'picky-token',
          appIds: ['picky'],
        },
      ],
    })
    // 허용된 앱(대소문자 무관) → 통과
    expect(
      appGuard.canActivate(
        ctxOf({ headers: { 'x-admin-token': 'picky-token' }, params: { appId: 'picky' } })
      )
    ).toBe(true)
    expect(
      appGuard.canActivate(
        ctxOf({ headers: { 'x-admin-token': 'picky-token' }, params: { appId: 'PICKY' } })
      )
    ).toBe(true)
    // 다른 앱 → 403
    expect(() =>
      appGuard.canActivate(
        ctxOf({ headers: { 'x-admin-token': 'picky-token' }, params: { appId: 'promptmarket' } })
      )
    ).toThrow(ForbiddenException)
    // appId 라우트가 아니면(앱 스코프 토큰) → 403
    expect(() =>
      appGuard.canActivate(ctxOf({ headers: { 'x-admin-token': 'picky-token' }, params: {} }))
    ).toThrow(ForbiddenException)
    // 전역(legacy) 토큰은 appId 무관 통과
    expect(
      appGuard.canActivate(
        ctxOf({ headers: { 'x-admin-token': 'legacy' }, params: { appId: 'anything' } })
      )
    ).toBe(true)
  })
})

describe('SecretKeyGuard', () => {
  let tenants: TenantService
  let guard: SecretKeyGuard
  let secretKey: string

  beforeEach(async () => {
    tenants = new TenantService(new InMemoryTenantStore(), 'pep')
    guard = new SecretKeyGuard(tenants)
    secretKey = (await tenants.signup({ name: 'Acme' })).secretKey
  })

  it('유효한 Bearer sk_… 면 통과 + req.deskTenant 부착', async () => {
    const req: Record<string, unknown> = { headers: { authorization: `Bearer ${secretKey}` } }
    expect(await guard.canActivate(ctxOf(req))).toBe(true)
    expect((req[TENANT_CONTEXT_KEY] as { name: string }).name).toBe('Acme')
  })

  it('헤더 없음/잘못된 키면 401', async () => {
    await expect(guard.canActivate(ctxOf({ headers: {} }))).rejects.toThrow(UnauthorizedException)
    await expect(
      guard.canActivate(ctxOf({ headers: { authorization: 'Bearer sk_bogus' } }))
    ).rejects.toThrow(UnauthorizedException)
  })
})

describe('PublishableKeyGuard', () => {
  let tenants: TenantService
  let guard: PublishableKeyGuard
  let pk: string

  beforeEach(async () => {
    tenants = new TenantService(new InMemoryTenantStore(), 'pep')
    guard = new PublishableKeyGuard(tenants)
    const t = await tenants.signup({ name: 'Acme', corsOrigins: ['https://app.example'] })
    pk = t.publishableKey
  })

  it('유효한 pk + allowlist origin 이면 통과', async () => {
    const req: Record<string, unknown> = {
      headers: { 'x-desk-key': pk, origin: 'https://app.example' },
    }
    expect(await guard.canActivate(ctxOf(req))).toBe(true)
    expect((req[TENANT_CONTEXT_KEY] as { name: string }).name).toBe('Acme')
  })

  it('origin 없는 서버 요청도 통과(브라우저 아님)', async () => {
    expect(await guard.canActivate(ctxOf({ headers: { 'x-desk-key': pk } }))).toBe(true)
  })

  it('allowlist 밖 origin 이면 403', async () => {
    await expect(
      guard.canActivate(ctxOf({ headers: { 'x-desk-key': pk, origin: 'https://evil.example' } }))
    ).rejects.toThrow(ForbiddenException)
  })

  it('pk 없음/잘못이면 401', async () => {
    await expect(guard.canActivate(ctxOf({ headers: {} }))).rejects.toThrow(UnauthorizedException)
    await expect(
      guard.canActivate(ctxOf({ headers: { 'x-desk-key': 'pk_bogus' } }))
    ).rejects.toThrow(UnauthorizedException)
  })
})
