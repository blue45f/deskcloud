import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { HttpException } from '@nestjs/common'
import { PLAN_LIMITS } from '@termsdesk/shared'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ApiKeysService } from '../apikeys/apikeys.service'
import { DatabaseService } from '../db/database.service'
import { apiKeys, apiUsage, organizations, policies, users } from '../db/schema'
import { MembersService } from '../members/members.service'
import { PoliciesService } from '../policies/policies.service'

import { AuditService } from './audit.service'
import { randomUUID } from './crypto'
import { PlanService, utcMonthKey } from './plan.service'

import type { AppConfig } from '../config'
import type { AuthUser } from './request-context'

const baseConfig = (dir: string): AppConfig => ({
  mode: 'saas',
  port: 0,
  webOrigin: 'http://localhost',
  databaseUrl: null,
  pgliteDir: dir,
  jwtSecret: 'test',
  seedAdminEmail: 'admin@example.com',
  seedAdminPassword: 'password',
  publicCacheTtl: 60,
  allowSignup: true,
  googleClientId: null,
  allowDemo: false,
  inquiryAllowedOrigins: [],
})

const userOf = (orgId: string): AuthUser => ({
  userId: randomUUID(),
  orgId,
  role: 'owner',
  name: '운영자',
  email: 'op@example.com',
})

/** 비동기 호출의 HTTP 상태 — 성공 null, HttpException 외 -1. */
const statusOf = async (p: Promise<unknown>): Promise<number | null> => {
  try {
    await p
    return null
  } catch (e) {
    return e instanceof HttpException ? e.getStatus() : -1
  }
}

describe('PlanService (PGlite)', () => {
  let dir: string
  let dbs: DatabaseService
  let plans: PlanService

  const insertOrg = async (plan: string) => {
    const [row] = await dbs.db
      .insert(organizations)
      .values({ name: '에이크미', slug: `acme-${randomUUID().slice(0, 8)}`, plan })
      .returning()
    return row!
  }

  const insertUser = (orgId: string, n: number) =>
    dbs.db.insert(users).values({ orgId, email: `u${n}@example.com`, name: `유저${n}` })

  const insertPolicy = (orgId: string, n: number, archivedAt: Date | null = null) =>
    dbs.db.insert(policies).values({ orgId, slug: `policy-${n}`, name: `정책 ${n}`, archivedAt })

  const insertApiKey = (orgId: string, n: number, revokedAt: Date | null = null) =>
    dbs.db
      .insert(apiKeys)
      .values({ orgId, name: `키 ${n}`, keyPrefix: `td_${n}`, keyHash: randomUUID(), revokedAt })

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'termsdesk-plan-'))
    dbs = new DatabaseService(baseConfig(dir))
    await dbs.onModuleInit()
    plans = new PlanService(dbs)
  })

  afterEach(async () => {
    await dbs.onModuleDestroy()
    rmSync(dir, { recursive: true, force: true })
  })

  describe('한도 가드 — 402 Payment Required', () => {
    it('free 멤버 한도(2): 미만이면 통과, 도달하면 402 + 업그레이드 안내', async () => {
      const org = await insertOrg('free')
      await insertUser(org.id, 1)
      expect(await statusOf(plans.assertCanAddMember(org.id))).toBeNull()

      await insertUser(org.id, 2)
      expect(await statusOf(plans.assertCanAddMember(org.id))).toBe(402)
      await expect(plans.assertCanAddMember(org.id)).rejects.toThrow(/업그레이드/)
    })

    it('free 정책 한도(3): 활성만 산입 — 보관된 정책은 제외', async () => {
      const org = await insertOrg('free')
      for (const n of [1, 2, 3]) await insertPolicy(org.id, n)
      expect(await statusOf(plans.assertCanAddPolicy(org.id))).toBe(402)

      // 하나를 보관 처리하면 다시 생성 가능
      await dbs.db
        .update(policies)
        .set({ archivedAt: new Date() })
        .where(and(eq(policies.orgId, org.id), eq(policies.slug, 'policy-1')))
      expect(await statusOf(plans.assertCanAddPolicy(org.id))).toBeNull()
    })

    it('free API 키 한도(1): 활성만 산입 — 폐기된 키는 제외', async () => {
      const org = await insertOrg('free')
      await insertApiKey(org.id, 1)
      expect(await statusOf(plans.assertCanAddApiKey(org.id))).toBe(402)

      await insertApiKey(org.id, 2, new Date()) // 폐기 키는 영향 없음
      expect(await statusOf(plans.assertCanAddApiKey(org.id))).toBe(402)

      await dbs.db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.orgId, org.id))
      expect(await statusOf(plans.assertCanAddApiKey(org.id))).toBeNull()
    })

    it('team 정책 무제한(-1): 한도 초과 수량에서도 통과', async () => {
      const org = await insertOrg('team')
      for (let n = 1; n <= PLAN_LIMITS.free.policies + 2; n++) await insertPolicy(org.id, n)
      expect(await statusOf(plans.assertCanAddPolicy(org.id))).toBeNull()
    })

    it('알 수 없는 plan 값은 free 로 방어 판정한다', async () => {
      const org = await insertOrg('enterprise-legacy')
      await insertUser(org.id, 1)
      await insertUser(org.id, 2)
      expect(await statusOf(plans.assertCanAddMember(org.id))).toBe(402)
    })
  })

  describe('가드 배선 — invite/create 경로가 402 를 전파', () => {
    it('MembersService.invite: free 시트 한도에서 402, 멤버 미생성', async () => {
      const org = await insertOrg('free')
      const audit = new AuditService(dbs)
      const members = new MembersService(dbs, audit, plans)
      await insertUser(org.id, 1)
      await insertUser(org.id, 2)

      const status = await statusOf(
        members.invite(org.id, userOf(org.id), {
          email: 'new@example.com',
          name: '신규',
          role: 'viewer',
          password: 'password123',
        })
      )
      expect(status).toBe(402)
      const rows = await dbs.db.select().from(users).where(eq(users.orgId, org.id))
      expect(rows).toHaveLength(2)
    })

    it('PoliciesService.create: free 정책 한도에서 402', async () => {
      const org = await insertOrg('free')
      const audit = new AuditService(dbs)
      const svc = new PoliciesService(dbs, audit, plans)
      for (const n of [1, 2, 3]) await insertPolicy(org.id, n)

      const status = await statusOf(
        svc.create(org.id, userOf(org.id), {
          slug: 'tos',
          name: '이용약관',
          type: 'terms',
          jurisdiction: 'KR',
        })
      )
      expect(status).toBe(402)
    })

    it('ApiKeysService.create: free 키 한도에서 402', async () => {
      const org = await insertOrg('free')
      const audit = new AuditService(dbs)
      const svc = new ApiKeysService(dbs, audit, plans)
      await insertApiKey(org.id, 1)

      const status = await statusOf(
        svc.create(org.id, userOf(org.id), { name: '두번째 키', scopes: ['read:current'] })
      )
      expect(status).toBe(402)
    })
  })

  describe('API 미터링 — api_usage UPSERT + 429', () => {
    const usageRow = async (orgId: string) => {
      const rows = await dbs.db
        .select()
        .from(apiUsage)
        .where(and(eq(apiUsage.orgId, orgId), eq(apiUsage.yyyymm, utcMonthKey())))
      return rows[0]
    }

    it('호출마다 같은 (org, yyyymm) 행을 UPSERT 증가시킨다', async () => {
      const org = await insertOrg('free')
      await plans.meterApiCall(org.id)
      await plans.meterApiCall(org.id)
      await plans.meterApiCall(org.id)

      const all = await dbs.db.select().from(apiUsage).where(eq(apiUsage.orgId, org.id))
      expect(all).toHaveLength(1) // 행 증식 없이 단일 카운터
      expect(all[0]!.count).toBe(3)
      expect(all[0]!.yyyymm).toBe(utcMonthKey())
    })

    it('월 한도 도달 시 429 — 거부된 호출은 카운트를 부풀리지 않는다', async () => {
      const org = await insertOrg('free')
      const limit = PLAN_LIMITS.free.apiCallsPerMonth
      await dbs.db
        .insert(apiUsage)
        .values({ orgId: org.id, yyyymm: utcMonthKey(), count: limit - 1 })

      expect(await statusOf(plans.meterApiCall(org.id))).toBeNull() // 정확히 한도까지 허용
      expect((await usageRow(org.id))!.count).toBe(limit)

      expect(await statusOf(plans.meterApiCall(org.id))).toBe(429)
      await expect(plans.meterApiCall(org.id)).rejects.toThrow(/한도/)
      expect((await usageRow(org.id))!.count).toBe(limit) // 429 이후에도 고정
    })

    it('usage(): 플랜·한도·사용량 묶음을 돌려준다', async () => {
      const org = await insertOrg('pro')
      await insertUser(org.id, 1)
      await insertPolicy(org.id, 1)
      await insertPolicy(org.id, 2, new Date()) // 보관 — 미산입
      await insertApiKey(org.id, 1)
      await plans.meterApiCall(org.id)
      await plans.meterApiCall(org.id)

      const dto = await plans.usage(org.id)
      expect(dto.plan).toBe('pro')
      expect(dto.limits).toEqual(PLAN_LIMITS.pro)
      expect(dto.usage).toEqual({ members: 1, policies: 1, apiKeys: 1, apiCallsThisMonth: 2 })
      expect(dto.month).toMatch(/^\d{4}-\d{2}$/)
    })
  })
})
