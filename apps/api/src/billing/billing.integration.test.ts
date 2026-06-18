import { TenantService } from '@desk/core'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { type AppConfig } from '../config'
import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { DrizzleSubscriptionStore } from '../stores/drizzle-subscription.store'
import { DrizzleTenantStore } from '../stores/drizzle-tenant.store'

import { BillingService } from './billing.service'

import type { Database, DatabaseService } from '../db/database.service'

const PEPPER = 'it-billing-pepper'

function cfg(): AppConfig {
  return {
    mode: 'self-hosted',
    port: 0,
    webOrigin: 'http://localhost:6191',
    databaseUrl: null,
    pgliteDir: '',
    adminToken: 'x',
    keyPepper: PEPPER,
    billingProvider: 'stub',
  }
}

/** PGlite 인메모리 + 마이그레이션 → TenantService + BillingService 스택. */
async function makeStack(): Promise<{
  tenants: TenantService
  billing: BillingService
  store: DrizzleSubscriptionStore
}> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  const tenants = new TenantService(new DrizzleTenantStore(dbs), PEPPER)
  const store = new DrizzleSubscriptionStore(dbs)
  const billing = new BillingService(cfg(), tenants, store)
  return { tenants, billing, store }
}

/** stub 서명 헤더로 활성화 웹훅을 만든다. */
function activateWebhook(tenantId: string, plan: string) {
  return {
    body: JSON.stringify({ type: 'subscription.activated', tenantId, plan }),
    headers: { 'x-stub-signature': 'stub-ok' },
  }
}

describe('BillingService (PGlite, 풀 플로우)', () => {
  let tenants: TenantService
  let billing: BillingService

  beforeEach(async () => {
    ;({ tenants, billing } = await makeStack())
  })

  it('listPlans — 4개 플랜 + 한도/기능', () => {
    const plans = billing.listPlans()
    expect(plans.map((p) => p.plan)).toEqual(['free', 'pro', 'scale', 'enterprise'])
    expect(plans[0]!.features.removeBranding).toBe(false)
    expect(plans[1]!.priceKrwMonthly).toBe(29_000)
  })

  it('checkout(stub) → checkoutUrl + 구독 incomplete (실제 청구 없음)', async () => {
    const t = await tenants.signup({ name: 'Acme', plan: 'free' })
    const res = await billing.checkout(t.id, { plan: 'pro' })
    expect(res.charged).toBe(false)
    expect(res.checkoutUrl).toContain('stub_session=')
    const sub = await billing.getSubscription(t.id)
    expect(sub.status).toBe('incomplete')
  })

  it('Free/Enterprise 체크아웃은 거부', async () => {
    const t = await tenants.signup({ name: 'Acme' })
    await expect(billing.checkout(t.id, { plan: 'free' })).rejects.toThrow()
    await expect(billing.checkout(t.id, { plan: 'enterprise' })).rejects.toThrow()
  })

  it('웹훅 활성화 → 구독 active + tenant.plan=pro + 배지 제거', async () => {
    const t = await tenants.signup({ name: 'Acme', plan: 'free' })
    const wh = activateWebhook(t.id, 'pro')
    const result = await billing.handleWebhook('stub', wh.body, wh.headers)
    expect(result).not.toBeNull()
    expect(result!.status).toBe('active')
    expect(result!.plan).toBe('pro')
    expect(result!.showBadge).toBe(false) // 유료 → 배지 제거
    expect(result!.periodEnd).not.toBeNull()
    // tenant.plan 동기화 확인 — Desk 가 읽는 권위 소스.
    const fresh = await tenants.getById(t.id)
    expect(fresh.plan).toBe('pro')
  })

  it('웹훅 서명 틀리면 null(검증 실패)', async () => {
    const t = await tenants.signup({ name: 'Acme' })
    const r = await billing.handleWebhook(
      'stub',
      JSON.stringify({ type: 'subscription.activated', tenantId: t.id, plan: 'pro' }),
      { 'x-stub-signature': 'WRONG' }
    )
    expect(r).toBeNull()
  })

  it('전체 플로우: free → checkout → webhook(pro) → cancel → free', async () => {
    const t = await tenants.signup({ name: 'Acme', plan: 'free' })
    expect((await tenants.getById(t.id)).plan).toBe('free')

    await billing.checkout(t.id, { plan: 'pro' })
    const wh = activateWebhook(t.id, 'pro')
    await billing.handleWebhook('stub', wh.body, wh.headers)
    expect((await tenants.getById(t.id)).plan).toBe('pro')

    const canceled = await billing.cancel(t.id)
    expect(canceled.status).toBe('canceled')
    expect(canceled.plan).toBe('free')
    expect(canceled.showBadge).toBe(true) // Free → 배지 노출
    expect((await tenants.getById(t.id)).plan).toBe('free')
  })

  it('웹훅 업그레이드(pro→scale) 반영', async () => {
    const t = await tenants.signup({ name: 'Acme', plan: 'free' })
    await billing.handleWebhook('stub', activateWebhook(t.id, 'pro').body, {
      'x-stub-signature': 'stub-ok',
    })
    await billing.handleWebhook('stub', activateWebhook(t.id, 'scale').body, {
      'x-stub-signature': 'stub-ok',
    })
    const sub = await billing.getSubscription(t.id)
    expect(sub.plan).toBe('scale')
    expect((await tenants.getById(t.id)).plan).toBe('scale')
  })
})
