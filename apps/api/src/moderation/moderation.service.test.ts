import { PGlite } from '@electric-sql/pglite'
import { FREE_PLAN_LIMIT } from '@moderationdesk/shared'
import { HttpException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { describe, expect, it } from 'vitest'

import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { TenantsService, type TenantRow } from '../tenants/tenants.service'

import { AiAssistService, type AiAssistResult } from './ai-assist.service'
import { ModerationService } from './moderation.service'

import type { AppConfig } from '../config'
import type { Database, DatabaseService } from '../db/database.service'

const cfg: AppConfig = {
  mode: 'self-hosted',
  port: 0,
  webOrigin: 'http://localhost',
  databaseUrl: null,
  pgliteDir: '.data/test',
  adminToken: 'test-admin',
  freePlanLimit: FREE_PLAN_LIMIT,
  anthropicApiKey: null,
  aiModel: 'claude-haiku-4-5',
}

/** 테스트용 AI 보조 스텁 — enabled 와 점수를 주입. */
class FakeAi extends AiAssistService {
  constructor(
    private readonly on: boolean,
    private readonly result: AiAssistResult | null
  ) {
    super(cfg)
  }
  override get enabled(): boolean {
    return this.on
  }
  override async score(): Promise<AiAssistResult | null> {
    return this.result
  }
}

async function setup(
  aiOn = false,
  aiResult: AiAssistResult | null = null
): Promise<{
  dbs: DatabaseService
  tenants: TenantsService
  moderation: ModerationService
}> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  const tenants = new TenantsService(dbs)
  const ai = new FakeAi(aiOn, aiResult)
  const moderation = new ModerationService(dbs, tenants, ai, cfg)
  return { dbs, tenants, moderation }
}

async function makeTenant(
  tenants: TenantsService,
  plan: 'free' | 'pro' = 'pro'
): Promise<TenantRow> {
  const res = await tenants.createTenant({ name: 'T', corsOrigins: ['*'] })
  if (plan !== 'free') await tenants.updateTenant(res.tenant.id, { plan })
  return (await tenants.findById(res.tenant.id))!
}

async function addRule(
  dbs: DatabaseService,
  tenantId: string,
  over: Partial<typeof schema.forbiddenRules.$inferInsert> &
    Pick<typeof schema.forbiddenRules.$inferInsert, 'pattern'>
): Promise<void> {
  await dbs.db.insert(schema.forbiddenRules).values({
    tenantId,
    kind: 'substring',
    action: 'block',
    enabled: true,
    ...over,
  })
}

describe('ModerationService (PGlite)', () => {
  it('규칙 매칭 없으면 allow, 로그 적재', async () => {
    const { dbs, tenants, moderation } = await setup()
    const t = await makeTenant(tenants)
    const r = await moderation.moderate(t, { text: 'a friendly message' })
    expect(r.verdict).toBe('allow')
    expect(r.matchedRules).toHaveLength(0)
    expect(r.logId).toBeTruthy()
    expect(r.aiScore).toBeUndefined()

    const logs = await dbs.db.select().from(schema.moderationLogs)
    expect(logs).toHaveLength(1)
    expect(logs[0]!.verdict).toBe('allow')
  })

  it('금칙어(block 규칙) 매칭 시 block', async () => {
    const { dbs, tenants, moderation } = await setup()
    const t = await makeTenant(tenants)
    await addRule(dbs, t.id, { pattern: 'spam', action: 'block' })
    const r = await moderation.moderate(t, { text: 'this is SPAM' })
    expect(r.verdict).toBe('block')
    expect(r.matchedRules).toHaveLength(1)
  })

  it('verdict 우선순위: block > flag (둘 다 매칭이면 block)', async () => {
    const { dbs, tenants, moderation } = await setup()
    const t = await makeTenant(tenants)
    await addRule(dbs, t.id, { pattern: 'meh', action: 'flag' })
    await addRule(dbs, t.id, { pattern: 'bad', action: 'block' })
    const r = await moderation.moderate(t, { text: 'meh and bad' })
    expect(r.verdict).toBe('block')
  })

  it('비활성 규칙은 무시', async () => {
    const { dbs, tenants, moderation } = await setup()
    const t = await makeTenant(tenants)
    await addRule(dbs, t.id, { pattern: 'spam', action: 'block', enabled: false })
    const r = await moderation.moderate(t, { text: 'spam spam spam' })
    expect(r.verdict).toBe('allow')
  })

  it('검사 시 usageCount 증가', async () => {
    const { tenants, moderation } = await setup()
    const t = await makeTenant(tenants)
    await moderation.moderate(t, { text: 'one' })
    await moderation.moderate(t, { text: 'two' })
    const after = (await tenants.findById(t.id))!
    expect(after.usageCount).toBe(2)
  })

  it('무료 플랜 소프트 한도 초과 시 402', async () => {
    const { dbs, tenants, moderation } = await setup()
    const t = await makeTenant(tenants, 'free')
    await dbs.db
      .update(schema.tenants)
      .set({ usageCount: cfg.freePlanLimit })
      .where(eq(schema.tenants.id, t.id))
    const atLimit = (await tenants.findById(t.id))!
    await expect(moderation.moderate(atLimit, { text: 'x' })).rejects.toBeInstanceOf(HttpException)
  })

  it('pro 플랜은 한도 무관하게 검사 가능', async () => {
    const { dbs, tenants, moderation } = await setup()
    const t = await makeTenant(tenants, 'pro')
    await dbs.db
      .update(schema.tenants)
      .set({ usageCount: cfg.freePlanLimit + 100 })
      .where(eq(schema.tenants.id, t.id))
    const overLimit = (await tenants.findById(t.id))!
    const r = await moderation.moderate(overLimit, { text: 'x' })
    expect(r.logId).toBeTruthy()
  })

  it('AI 비활성(키 없음)이면 aiScore 없음 — 규칙 기반만(우아한 폴백)', async () => {
    const { tenants, moderation } = await setup(false, null)
    const t = await makeTenant(tenants)
    const r = await moderation.moderate(t, { text: 'neutral text' })
    expect(r.aiScore).toBeUndefined()
    expect(r.verdict).toBe('allow')
  })

  it('AI 활성 + 높은 점수면 allow → flag 격상, aiScore 기록', async () => {
    const { dbs, tenants, moderation } = await setup(true, { score: 0.9 })
    const t = await makeTenant(tenants)
    const r = await moderation.moderate(t, { text: 'subtly toxic but no rule match' })
    expect(r.verdict).toBe('flag') // AI 가 flag 로 격상
    expect(r.aiScore).toBe(0.9)

    const logs = await dbs.db.select().from(schema.moderationLogs)
    expect(logs[0]!.aiScore).toBe(0.9)
  })

  it('AI 활성이지만 낮은 점수면 verdict 격상 없음', async () => {
    const { tenants, moderation } = await setup(true, { score: 0.1 })
    const t = await makeTenant(tenants)
    const r = await moderation.moderate(t, { text: 'fine' })
    expect(r.verdict).toBe('allow')
    expect(r.aiScore).toBe(0.1)
  })

  it('AI 는 block 을 만들지 않는다(규칙 block 유지, AI 점수 무관)', async () => {
    const { dbs, tenants, moderation } = await setup(true, { score: 0.99 })
    const t = await makeTenant(tenants)
    await addRule(dbs, t.id, { pattern: 'forbidden', action: 'block' })
    const r = await moderation.moderate(t, { text: 'forbidden word here' })
    expect(r.verdict).toBe('block') // 규칙 block 유지
  })

  it('useAi:false 면 AI 가 켜져 있어도 건너뜀', async () => {
    const { tenants, moderation } = await setup(true, { score: 0.95 })
    const t = await makeTenant(tenants)
    const r = await moderation.moderate(t, { text: 'whatever', useAi: false })
    expect(r.aiScore).toBeUndefined()
    expect(r.verdict).toBe('allow')
  })

  it('AI score()가 null 반환(런타임 오류 폴백)이면 규칙 결과 그대로', async () => {
    const { tenants, moderation } = await setup(true, null)
    const t = await makeTenant(tenants)
    const r = await moderation.moderate(t, { text: 'anything' })
    expect(r.aiScore).toBeUndefined()
    expect(r.verdict).toBe('allow')
  })

  it('테넌트 격리 — 규칙은 자기 테넌트 것만 평가', async () => {
    const { dbs, tenants, moderation } = await setup()
    const t1 = await makeTenant(tenants)
    const t2 = await makeTenant(tenants)
    await addRule(dbs, t1.id, { pattern: 'secret', action: 'block' })
    // t2 에는 규칙이 없으므로 같은 텍스트도 allow
    expect((await moderation.moderate(t2, { text: 'secret leak' })).verdict).toBe('allow')
    expect((await moderation.moderate(t1, { text: 'secret leak' })).verdict).toBe('block')
  })
})
