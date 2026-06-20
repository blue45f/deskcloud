import { PGlite } from '@electric-sql/pglite'
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/pglite'
import { describe, expect, it } from 'vitest'

import { loadConfig } from '../config'
import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'

import { PublishableKeyGuard } from './publishable-key.guard'
import { SecretKeyGuard } from './secret-key.guard'
import { TenantsService } from './tenants.service'

import type { AuthedRequest } from './tenant-context'
import type { Database, DatabaseService } from '../db/database.service'

interface GuardHarness {
  tenants: TenantsService
  pubGuard: PublishableKeyGuard
  secGuard: SecretKeyGuard
  pk: string
  sk: string
  tenantId: string
}

async function makeHarness(corsOrigins?: string[]): Promise<GuardHarness> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) {
    if (m.only && !m.only.includes('pglite')) continue
    await client.exec(m.sql)
  }
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  const tenants = new TenantsService(dbs)
  const cfg = loadConfig()
  const creds = await tenants.signup({ name: 'Guard Co', corsOrigins })
  return {
    tenants,
    pubGuard: new PublishableKeyGuard(tenants),
    secGuard: new SecretKeyGuard(tenants, cfg),
    pk: creds.publishableKey,
    sk: creds.secretKey,
    tenantId: creds.id,
  }
}

/**
 * 가짜 ExecutionContext — 전달된 req 객체를 그대로 노출한다(가드가 tenantCtx 를 부착하는
 * 대상이 호출 측이 검사하는 바로 그 객체가 되도록 동일 참조를 유지). 누락 필드는 미리 채운다.
 */
function ctxOf(req: Partial<AuthedRequest>): ExecutionContext {
  req.headers ??= {}
  req.params ??= {}
  req.query ??= {}
  return {
    switchToHttp: () => ({ getRequest: () => req as AuthedRequest }),
  } as unknown as ExecutionContext
}

describe('PublishableKeyGuard (pk_ + Origin)', () => {
  it('유효한 pk + 허용 Origin 이면 통과하고 tenantCtx 부착(via=publishable)', async () => {
    const h = await makeHarness(['https://app.example.com'])
    const req: Partial<AuthedRequest> = {
      headers: { authorization: `Bearer ${h.pk}`, origin: 'https://app.example.com' },
    }
    const ctx = ctxOf(req)
    await expect(h.pubGuard.canActivate(ctx)).resolves.toBe(true)
    expect((req as AuthedRequest).tenantCtx?.via).toBe('publishable')
  })

  it("cors '*' 면 어떤 Origin 도 허용", async () => {
    const h = await makeHarness(['*'])
    const req = { headers: { authorization: `Bearer ${h.pk}`, origin: 'https://anything.test' } }
    await expect(h.pubGuard.canActivate(ctxOf(req))).resolves.toBe(true)
  })

  it('허용목록 밖 Origin 은 403', async () => {
    const h = await makeHarness(['https://app.example.com'])
    const req = { headers: { authorization: `Bearer ${h.pk}`, origin: 'https://evil.test' } }
    await expect(h.pubGuard.canActivate(ctxOf(req))).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('pk 경로에 secret 키를 쓰면 401', async () => {
    const h = await makeHarness(['*'])
    const req = { headers: { authorization: `Bearer ${h.sk}`, origin: 'https://x.test' } }
    await expect(h.pubGuard.canActivate(ctxOf(req))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('알 수 없는 pk 는 401', async () => {
    const h = await makeHarness(['*'])
    const req = { headers: { authorization: 'Bearer pk_unknownunknown', origin: 'https://x.test' } }
    await expect(h.pubGuard.canActivate(ctxOf(req))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('키가 없으면 401', async () => {
    const h = await makeHarness(['*'])
    await expect(h.pubGuard.canActivate(ctxOf({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException
    )
  })
})

describe('SecretKeyGuard (sk_ 또는 X-Admin-Token)', () => {
  it('유효한 sk 면 통과(via=secret)', async () => {
    const h = await makeHarness()
    const req: Partial<AuthedRequest> = { headers: { authorization: `Bearer ${h.sk}` } }
    const ctx = ctxOf(req)
    await expect(h.secGuard.canActivate(ctx)).resolves.toBe(true)
    expect((req as AuthedRequest).tenantCtx?.via).toBe('secret')
  })

  it('sk 경로에 publishable 키를 쓰면 401', async () => {
    const h = await makeHarness()
    const req = { headers: { authorization: `Bearer ${h.pk}` } }
    await expect(h.secGuard.canActivate(ctxOf(req))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('X-Admin-Token + ?tenantId 면 통과(via=admin)', async () => {
    const h = await makeHarness()
    const req: Partial<AuthedRequest> = {
      headers: { 'x-admin-token': 'dev-admin-token-change-me' },
      query: { tenantId: h.tenantId },
    }
    const ctx = ctxOf(req)
    await expect(h.secGuard.canActivate(ctx)).resolves.toBe(true)
    expect((req as AuthedRequest).tenantCtx?.via).toBe('admin')
  })

  it('잘못된 X-Admin-Token 은 401', async () => {
    const h = await makeHarness()
    const req = { headers: { 'x-admin-token': 'wrong' }, query: { tenantId: h.tenantId } }
    await expect(h.secGuard.canActivate(ctxOf(req))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('X-Admin-Token 인데 tenantId 누락이면 401', async () => {
    const h = await makeHarness()
    const req = { headers: { 'x-admin-token': 'dev-admin-token-change-me' }, query: {} }
    await expect(h.secGuard.canActivate(ctxOf(req))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('키도 토큰도 없으면 401', async () => {
    const h = await makeHarness()
    await expect(h.secGuard.canActivate(ctxOf({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException
    )
  })
})
