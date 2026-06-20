import { isSecretKey, verifySecretKey } from '@changelogdesk/shared'
import { PGlite } from '@electric-sql/pglite'
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/pglite'
import { describe, expect, it } from 'vitest'

import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'

import { AdminAuthGuard } from './admin-auth.guard'
import { PublishableKeyGuard } from './publishable-key.guard'
import { TenantContextService } from './tenant-context.service'
import { TenantsService } from './tenants.service'

import type { AppConfig } from '../config'
import type { AuthedRequest } from './request-context'
import type { Database, DatabaseService } from '../db/database.service'

const CFG: AppConfig = {
  mode: 'self-hosted',
  port: 0,
  webOrigin: 'http://localhost',
  databaseUrl: null,
  pgliteDir: '.data/test',
  adminToken: 'GLOBAL-ADMIN-TOKEN',
  freeMonthlyLimit: 100,
}

async function setup(): Promise<{
  dbs: DatabaseService
  tenants: TenantsService
  ctx: TenantContextService
  pkGuard: PublishableKeyGuard
  adminGuard: AdminAuthGuard
}> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  const ctx = new TenantContextService(dbs, CFG)
  return {
    dbs,
    tenants: new TenantsService(dbs, CFG),
    ctx,
    pkGuard: new PublishableKeyGuard(ctx),
    adminGuard: new AdminAuthGuard(ctx),
  }
}

/** Express 요청을 흉내 내는 ExecutionContext. */
function makeCtx(req: Partial<AuthedRequest>): { exec: ExecutionContext; req: AuthedRequest } {
  const full = { headers: {}, query: {}, ...req } as AuthedRequest
  const exec = {
    switchToHttp: () => ({ getRequest: () => full }),
  } as unknown as ExecutionContext
  return { exec, req: full }
}

describe('signup — key issuance & hashing', () => {
  it('가입 시 pk/sk 발급, sk 는 해시 저장(평문 1회만 반환)', async () => {
    const { tenants, dbs } = await setup()
    const res = await tenants.signup({ name: 'Acme Corp' })

    expect(res.publishableKey.startsWith('pk_')).toBe(true)
    expect(isSecretKey(res.secretKey)).toBe(true)
    expect(res.tenant.slug).toBe('acme-corp')
    expect(res.tenant.plan).toBe('free')

    // DB 에는 sk 평문이 없고 해시만 있다
    const row = (await dbs.db.select().from(schema.tenants))[0]!
    expect(row.secretKeyHash).not.toBe(res.secretKey)
    expect(verifySecretKey(res.secretKey, row.secretKeyHash)).toBe(true)
    // TenantDto 에는 시크릿이 절대 없다
    expect(JSON.stringify(res.tenant)).not.toContain(res.secretKey)
  })

  it('slug 충돌 시 접미사로 유니크 보장', async () => {
    const { tenants } = await setup()
    const a = await tenants.signup({ name: 'Dup' })
    const b = await tenants.signup({ name: 'Dup' })
    expect(a.tenant.slug).toBe('dup')
    expect(b.tenant.slug).toBe('dup-2')
  })

  it('키 회전 — 기존 키 무효화, 새 키 발급', async () => {
    const { tenants, ctx } = await setup()
    const created = await tenants.signup({ name: 'Rotate Me' })
    const oldPk = created.publishableKey
    const oldSk = created.secretKey

    const rotated = await tenants.rotateKeys(created.tenant.id)
    expect(rotated.publishableKey).not.toBe(oldPk)
    expect(rotated.secretKey).not.toBe(oldSk)

    // 옛 키는 더 이상 해석되지 않는다
    expect(await ctx.findByPublishableKey(oldPk)).toBeNull()
    expect(await ctx.resolveSecretKey(oldSk)).toBeNull()
    // 새 키는 동작
    expect(await ctx.findByPublishableKey(rotated.publishableKey)).not.toBeNull()
    expect(await ctx.resolveSecretKey(rotated.secretKey)).not.toBeNull()
  })
})

describe('PublishableKeyGuard — pk + Origin', () => {
  it('pk 없으면 401', async () => {
    const { pkGuard } = await setup()
    const { exec } = makeCtx({ headers: {} })
    await expect(pkGuard.canActivate(exec)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('잘못된 pk 는 401', async () => {
    const { pkGuard } = await setup()
    const { exec } = makeCtx({ headers: { 'x-pk': 'pk_nope', origin: 'https://x.com' } })
    await expect(pkGuard.canActivate(exec)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('허용 Origin 이면 통과 + req.authContext 주입', async () => {
    const { tenants, pkGuard } = await setup()
    const created = await tenants.signup({
      name: 'Widget Co',
      corsOrigins: ['https://app.widget.co'],
    })
    const { exec, req } = makeCtx({
      headers: { 'x-pk': created.publishableKey, origin: 'https://app.widget.co' },
    })
    await expect(pkGuard.canActivate(exec)).resolves.toBe(true)
    expect(req.authContext?.via).toBe('publishable')
    expect(req.authContext?.tenant?.id).toBe(created.tenant.id)
  })

  it('허용 안 된 Origin 은 403(CORS 강제)', async () => {
    const { tenants, pkGuard } = await setup()
    const created = await tenants.signup({
      name: 'Strict Co',
      corsOrigins: ['https://app.strict.co'],
    })
    const { exec } = makeCtx({
      headers: { 'x-pk': created.publishableKey, origin: 'https://evil.com' },
    })
    await expect(pkGuard.canActivate(exec)).rejects.toBeInstanceOf(ForbiddenException)
  })

  it("corsOrigins '*' 면 어떤 Origin 도 허용", async () => {
    const { tenants, pkGuard } = await setup()
    const created = await tenants.signup({ name: 'Open Co', corsOrigins: ['*'] })
    const { exec } = makeCtx({
      headers: { 'x-pk': created.publishableKey, origin: 'https://anything.dev' },
    })
    await expect(pkGuard.canActivate(exec)).resolves.toBe(true)
  })

  it('?pk= 쿼리로도 키 전달 가능', async () => {
    const { tenants, pkGuard } = await setup()
    const created = await tenants.signup({ name: 'Query Co', corsOrigins: ['*'] })
    const { exec } = makeCtx({ query: { pk: created.publishableKey }, headers: {} })
    await expect(pkGuard.canActivate(exec)).resolves.toBe(true)
  })
})

describe('AdminAuthGuard — secret key vs admin token', () => {
  it('유효한 시크릿 키는 그 테넌트 컨텍스트로 통과', async () => {
    const { tenants, adminGuard } = await setup()
    const created = await tenants.signup({ name: 'SK Co' })
    const { exec, req } = makeCtx({ headers: { 'x-sk': created.secretKey } })
    await expect(adminGuard.canActivate(exec)).resolves.toBe(true)
    expect(req.authContext?.via).toBe('secret-key')
    expect(req.authContext?.tenant?.id).toBe(created.tenant.id)
  })

  it('잘못된 시크릿 키는 401', async () => {
    const { adminGuard } = await setup()
    const { exec } = makeCtx({ headers: { 'x-sk': 'sk_bogus' } })
    await expect(adminGuard.canActivate(exec)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('글로벌 ADMIN_TOKEN 은 테넌트 비종속으로 통과', async () => {
    const { adminGuard } = await setup()
    const { exec, req } = makeCtx({ headers: { 'x-admin-token': 'GLOBAL-ADMIN-TOKEN' } })
    await expect(adminGuard.canActivate(exec)).resolves.toBe(true)
    expect(req.authContext?.via).toBe('admin-token')
    expect(req.authContext?.tenant).toBeNull()
  })

  it('퍼블리시 키로는 어드민 통과 불가(키 분리 강제)', async () => {
    const { tenants, adminGuard } = await setup()
    const created = await tenants.signup({ name: 'No Cross' })
    // pk 를 sk 자리에 넣어도 거부
    const { exec } = makeCtx({ headers: { 'x-sk': created.publishableKey } })
    await expect(adminGuard.canActivate(exec)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('인증 헤더 전무하면 401', async () => {
    const { adminGuard } = await setup()
    const { exec } = makeCtx({ headers: {} })
    await expect(adminGuard.canActivate(exec)).rejects.toBeInstanceOf(UnauthorizedException)
  })
})

describe('usage counter & free limit', () => {
  it('incrementUsage 가 누적되고 free 한도 초과 시 overLimit', async () => {
    const { tenants, ctx } = await setup()
    const created = await tenants.signup({ name: 'Usage Co' }) // free, 한도 100

    for (let i = 0; i < 3; i += 1) await tenants.incrementUsage(created.tenant.id)
    let dto = await tenants.get(created.tenant.id)
    expect(dto.usageCount).toBe(3)
    expect(dto.overLimit).toBe(false)

    // 한도(100)를 넘기면 overLimit + isOverFreeLimit 동의
    const { eq } = await import('drizzle-orm')
    await (tenants as unknown as { dbs: DatabaseService }).dbs.db
      .update(schema.tenants)
      .set({ usageCount: 101 })
      .where(eq(schema.tenants.id, created.tenant.id))

    dto = await tenants.get(created.tenant.id)
    expect(dto.overLimit).toBe(true)
    const row = await ctx.findById(created.tenant.id)
    expect(ctx.isOverFreeLimit(row!)).toBe(true)
  })

  it('pro 플랜은 한도를 넘어도 overLimit 아님', async () => {
    const { tenants, ctx } = await setup()
    const created = await tenants.signup({ name: 'Pro Co' })
    await tenants.update(created.tenant.id, { plan: 'pro' })
    const { eq } = await import('drizzle-orm')
    await (tenants as unknown as { dbs: DatabaseService }).dbs.db
      .update(schema.tenants)
      .set({ usageCount: 999 })
      .where(eq(schema.tenants.id, created.tenant.id))
    const row = await ctx.findById(created.tenant.id)
    expect(ctx.isOverFreeLimit(row!)).toBe(false)
  })
})
