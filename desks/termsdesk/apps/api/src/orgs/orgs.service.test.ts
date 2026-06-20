import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { BadRequestException } from '@nestjs/common'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AuditService } from '../common/audit.service'
import { randomUUID } from '../common/crypto'
import { DatabaseService } from '../db/database.service'
import { auditEvents, organizations } from '../db/schema'

import { OrgsService } from './orgs.service'

import type { AuthUser } from '../common/request-context'
import type { AppConfig } from '../config'

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

describe('OrgsService.changePlan (mock 청구 — 결정 기록만)', () => {
  let dir: string
  let dbs: DatabaseService
  let audit: AuditService
  let service: OrgsService
  let orgId: string
  let actor: AuthUser

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'termsdesk-orgs-'))
    dbs = new DatabaseService(baseConfig(dir))
    await dbs.onModuleInit()
    audit = new AuditService(dbs)
    service = new OrgsService(dbs, audit)
    const [org] = await dbs.db
      .insert(organizations)
      .values({ name: '에이크미', slug: 'acme' })
      .returning()
    orgId = org!.id
    actor = { userId: randomUUID(), orgId, role: 'owner', name: '오너', email: 'o@example.com' }
  })

  afterEach(async () => {
    await dbs.onModuleDestroy()
    rmSync(dir, { recursive: true, force: true })
  })

  it('plan/plan_changed_at 을 갱신하고 변경된 OrgDto 를 돌려준다', async () => {
    const dto = await service.changePlan(orgId, actor, { plan: 'pro' })
    expect(dto.plan).toBe('pro')
    expect(dto.planChangedAt).not.toBeNull()

    const [row] = await dbs.db.select().from(organizations)
    expect(row!.plan).toBe('pro')
    expect(row!.planChangedAt).not.toBeNull()
  })

  it("감사 이벤트 'org.plan_changed' 를 mock 결정 기록으로 남긴다 (자금 이동 없음)", async () => {
    await service.changePlan(orgId, actor, { plan: 'team' })

    const rows = await dbs.db.select().from(auditEvents)
    const row = rows.find((ev) => ev.action === 'org.plan_changed')
    expect(row).toBeDefined()
    expect(row!.actorName).toBe('오너')
    expect(row!.targetType).toBe('org')
    expect(row!.metadata).toMatchObject({ from: 'free', to: 'team', mockBilling: true })

    // 대시보드 '최근 활동' 표면(DTO summary)에도 데모 라벨이 그대로 노출된다.
    const events = await audit.list(orgId)
    const dto = events.find((ev) => ev.action === 'org.plan_changed')
    expect(dto!.summary).toContain('실제 결제 없음')
  })

  it('이미 사용 중인 플랜으로의 변경은 400', async () => {
    await expect(service.changePlan(orgId, actor, { plan: 'free' })).rejects.toBeInstanceOf(
      BadRequestException
    )
    const events = await audit.list(orgId)
    expect(events.find((ev) => ev.action === 'org.plan_changed')).toBeUndefined()
  })
})
