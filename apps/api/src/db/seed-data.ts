import { TenantService } from '@desk/core'
import { sql } from 'drizzle-orm'

import { DrizzleTenantStore } from '../stores/drizzle-tenant.store'
import { DrizzleUsageStore } from '../stores/drizzle-usage.store'

import { DatabaseService } from './database.service'
import { tenants } from './schema'

import type { Plan } from '@desk/shared'

interface DemoTenant {
  name: string
  slug: string
  plan: Plan
  corsOrigins: string[]
}

/** 데모 테넌트 — Free 1 + Pro 1. 통합 데모가 자연스럽게 보이도록 형제 앱스러운 이름 사용. */
const DEMO_TENANTS: DemoTenant[] = [
  {
    name: 'Demo (Free)',
    slug: 'demo-free',
    plan: 'free',
    corsOrigins: ['http://localhost:6091', 'https://demo.example'],
  },
  {
    name: 'OffHours (Pro)',
    slug: 'offhours-pro',
    plan: 'pro',
    corsOrigins: ['http://localhost:6091', 'https://offhours.example'],
  },
]

export interface SeedResult {
  seeded: boolean
  /** 생성된 테넌트별 발급 키(secret 평문 포함) — 부팅 로그/시드 스크립트가 안내용으로 출력. */
  credentials: { slug: string; plan: Plan; publishableKey: string; secretKey: string }[]
}

/**
 * 멱등 시드 — 테넌트가 하나도 없을 때만 데모 테넌트(Free 1 + Pro 1)와 샘플 사용량을 채운다.
 * secret 키는 해시로만 저장되므로, 평문을 credentials 로 반환해 호출자가 안내할 수 있게 한다.
 *
 * @param opts.pepper 라이브 인증 경로(CoreModule)와 **동일한** keyPepper 를 넘겨야 한다.
 *   (다르면 시드된 키가 해시 불일치로 인증을 통과하지 못한다.)
 */
export async function runSeed(
  dbs: DatabaseService,
  opts: { demo: boolean; pepper?: string }
): Promise<SeedResult> {
  if (!opts.demo) return { seeded: false, credentials: [] }

  const existing = await dbs.db.select({ c: sql<number>`count(*)` }).from(tenants)
  if (Number(existing[0]?.c ?? 0) > 0) return { seeded: false, credentials: [] }

  const svc = new TenantService(new DrizzleTenantStore(dbs), opts.pepper ?? '')
  const usage = new DrizzleUsageStore(dbs)
  const credentials: SeedResult['credentials'] = []

  for (const def of DEMO_TENANTS) {
    const t = await svc.signup({
      name: def.name,
      slug: def.slug,
      plan: def.plan,
      corsOrigins: def.corsOrigins,
    })
    credentials.push({
      slug: t.slug,
      plan: t.plan,
      publishableKey: t.publishableKey,
      secretKey: t.secretKey,
    })

    // 집계 화면이 비지 않도록 이번 달 샘플 사용량 시드.
    const period = currentPeriod()
    await usage.increment(t.id, period, 'api_calls', def.plan === 'pro' ? 4_200 : 312)
    await usage.increment(t.id, period, 'events', def.plan === 'pro' ? 1_180 : 47)
    await usage.increment(t.id, period, 'seats', def.plan === 'pro' ? 3 : 1)
  }

  return { seeded: true, credentials }
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}
