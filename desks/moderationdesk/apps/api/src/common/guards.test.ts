import { PGlite } from '@electric-sql/pglite'
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { TenantsService } from '../tenants/tenants.service'

import { ModerateAuthGuard } from './moderate-auth.guard'
import { PublishableKeyGuard } from './publishable-key.guard'
import { SecretKeyGuard } from './secret-key.guard'
import { isOriginAllowed, type TenantRequest } from './tenant-context'

import type { AppConfig } from '../config'
import type { Database, DatabaseService } from '../db/database.service'

const cfg: AppConfig = {
  mode: 'self-hosted',
  port: 0,
  webOrigin: 'http://localhost',
  databaseUrl: null,
  pgliteDir: '.data/test',
  adminToken: 'global-admin-token',
  freePlanLimit: 1000,
  anthropicApiKey: null,
  aiModel: 'claude-haiku-4-5',
}

/**
 * 가짜 ExecutionContext — 전달된 요청 객체를 **그대로** 반환한다(가드가 req.tenant 를
 * 변이하므로 사본을 만들면 안 됨). headers/query 기본값은 호출자가 채워 넘긴다.
 */
function ctxOf(req: Partial<TenantRequest>): ExecutionContext {
  const request = req as TenantRequest
  request.headers ??= {} as TenantRequest['headers']
  request.query ??= {} as TenantRequest['query']
  return {
    switchToHttp: () => ({ getRequest: <T>() => request as T }),
  } as unknown as ExecutionContext
}

async function setup(): Promise<{ tenants: TenantsService }> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  return { tenants: new TenantsService(dbs) }
}

describe('isOriginAllowed', () => {
  it('* 면 모두 허용', () => {
    expect(isOriginAllowed('https://anything.example', ['*'])).toBe(true)
  })
  it('Origin 없으면 허용(서버-사이드 호출)', () => {
    expect(isOriginAllowed(undefined, ['https://a.example'])).toBe(true)
  })
  it('정확히 일치할 때만 허용', () => {
    expect(isOriginAllowed('https://a.example', ['https://a.example'])).toBe(true)
    expect(isOriginAllowed('https://evil.example', ['https://a.example'])).toBe(false)
  })
})

describe('PublishableKeyGuard', () => {
  let tenants: TenantsService
  let guard: PublishableKeyGuard

  beforeEach(async () => {
    ;({ tenants } = await setup())
    guard = new PublishableKeyGuard(tenants)
  })

  it('키 없으면 401', async () => {
    await expect(guard.canActivate(ctxOf({}))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('잘못된 pk 면 401', async () => {
    await expect(
      guard.canActivate(ctxOf({ headers: { 'x-pk': 'pk_wrong' } as never }))
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('유효한 pk + 허용 Origin 이면 통과하고 req.tenant 채움', async () => {
    const t = await tenants.createTenant({ name: 'X', corsOrigins: ['https://shop.example'] })
    const req = {
      headers: { 'x-pk': t.publishableKey, origin: 'https://shop.example' },
      query: {},
    } as unknown as TenantRequest
    const ok = await guard.canActivate(ctxOf(req))
    expect(ok).toBe(true)
    expect(req.tenant?.id).toBe(t.tenant.id)
  })

  it('?pk= 쿼리로도 키 전달 가능', async () => {
    const t = await tenants.createTenant({ name: 'X', corsOrigins: ['*'] })
    const req = { headers: {}, query: { pk: t.publishableKey } } as unknown as TenantRequest
    expect(await guard.canActivate(ctxOf(req))).toBe(true)
  })

  it('허용목록에 없는 Origin 이면 403', async () => {
    const t = await tenants.createTenant({ name: 'X', corsOrigins: ['https://shop.example'] })
    const req = {
      headers: { 'x-pk': t.publishableKey, origin: 'https://evil.example' },
      query: {},
    } as unknown as TenantRequest
    await expect(guard.canActivate(ctxOf(req))).rejects.toBeInstanceOf(ForbiddenException)
  })
})

describe('SecretKeyGuard', () => {
  let tenants: TenantsService
  let guard: SecretKeyGuard

  beforeEach(async () => {
    ;({ tenants } = await setup())
    guard = new SecretKeyGuard(tenants, cfg)
  })

  it('인증 없으면 401', async () => {
    await expect(guard.canActivate(ctxOf({}))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('잘못된 sk 면 401', async () => {
    await expect(
      guard.canActivate(ctxOf({ headers: { 'x-sk': 'sk_wrong' } as never }))
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('유효한 sk 면 그 테넌트로 스코프', async () => {
    const t = await tenants.createTenant({ name: 'X', corsOrigins: [] })
    const req = { headers: { 'x-sk': t.secretKey }, query: {} } as unknown as TenantRequest
    expect(await guard.canActivate(ctxOf(req))).toBe(true)
    expect(req.tenant?.id).toBe(t.tenant.id)
  })

  it('pk 를 sk 자리에 넣으면 거부(키 종류 분리)', async () => {
    const t = await tenants.createTenant({ name: 'X', corsOrigins: [] })
    await expect(
      guard.canActivate(ctxOf({ headers: { 'x-sk': t.publishableKey } as never }))
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('글로벌 ADMIN_TOKEN + x-tenant-id 로 임의 테넌트 접근', async () => {
    const t = await tenants.createTenant({ name: 'X', corsOrigins: [] })
    const req = {
      headers: { 'x-admin-token': cfg.adminToken, 'x-tenant-id': t.tenant.id },
      query: {},
    } as unknown as TenantRequest
    expect(await guard.canActivate(ctxOf(req))).toBe(true)
    expect(req.tenant?.id).toBe(t.tenant.id)
  })

  it('글로벌 토큰 + pk 로도 대상 테넌트 지정 가능', async () => {
    const t = await tenants.createTenant({ name: 'X', corsOrigins: [] })
    const req = {
      headers: { 'x-admin-token': cfg.adminToken, 'x-pk': t.publishableKey },
      query: {},
    } as unknown as TenantRequest
    expect(await guard.canActivate(ctxOf(req))).toBe(true)
    expect(req.tenant?.id).toBe(t.tenant.id)
  })

  it('글로벌 토큰만 있고 대상 테넌트 미지정이면 404', async () => {
    await expect(
      guard.canActivate(ctxOf({ headers: { 'x-admin-token': cfg.adminToken } as never }))
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('틀린 글로벌 토큰이면 401', async () => {
    await expect(
      guard.canActivate(ctxOf({ headers: { 'x-admin-token': 'nope' } as never }))
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })
})

describe('ModerateAuthGuard (pk 또는 sk)', () => {
  let tenants: TenantsService
  let guard: ModerateAuthGuard

  beforeEach(async () => {
    ;({ tenants } = await setup())
    guard = new ModerateAuthGuard(tenants)
  })

  it('키 없으면 401', async () => {
    await expect(guard.canActivate(ctxOf({}))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('sk 면 Origin 검사 없이 통과(서버-사이드)', async () => {
    const t = await tenants.createTenant({ name: 'X', corsOrigins: ['https://only.example'] })
    const req = { headers: { 'x-sk': t.secretKey }, query: {} } as unknown as TenantRequest
    expect(await guard.canActivate(ctxOf(req))).toBe(true)
    expect(req.tenant?.id).toBe(t.tenant.id)
  })

  it('pk + 허용 Origin 이면 통과', async () => {
    const t = await tenants.createTenant({ name: 'X', corsOrigins: ['https://shop.example'] })
    const req = {
      headers: { 'x-pk': t.publishableKey, origin: 'https://shop.example' },
      query: {},
    } as unknown as TenantRequest
    expect(await guard.canActivate(ctxOf(req))).toBe(true)
  })

  it('pk + 허용목록 밖 Origin 이면 403', async () => {
    const t = await tenants.createTenant({ name: 'X', corsOrigins: ['https://shop.example'] })
    const req = {
      headers: { 'x-pk': t.publishableKey, origin: 'https://evil.example' },
      query: {},
    } as unknown as TenantRequest
    await expect(guard.canActivate(ctxOf(req))).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('잘못된 pk 면 401', async () => {
    await expect(
      guard.canActivate(ctxOf({ headers: { 'x-pk': 'pk_nope' } as never }))
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
