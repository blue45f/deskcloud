import { hashSecret, isPublishableKey, isSecretKey, verifySecret } from '@chatdesk/shared'
import { PGlite } from '@electric-sql/pglite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { type AppConfig } from '../config'
import { ConversationsService } from '../conversations/conversations.service'
import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'

import { TenantsService } from './tenants.service'

import type { Database, DatabaseService } from '../db/database.service'

function cfg(): AppConfig {
  return {
    mode: 'self-hosted',
    port: 0,
    webOrigin: 'http://localhost',
    chatPath: '/chat',
    databaseUrl: null,
    pgliteDir: '.data/test',
    adminToken: 'test',
    memberTokenSecret: null,
  }
}

async function makeService(): Promise<{ dbs: DatabaseService; service: TenantsService }> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  return { dbs, service: new TenantsService(dbs, cfg()) }
}

describe('TenantsService (PGlite)', () => {
  let service: TenantsService
  let dbs: DatabaseService

  beforeEach(async () => {
    ;({ service, dbs } = await makeService())
  })

  it('가입 → pk·sk 발급, sk 는 응답 1회만 평문(해시는 검증 가능)', async () => {
    const t = await service.create({ name: 'Acme' })
    expect(isPublishableKey(t.publishableKey)).toBe(true)
    expect(isSecretKey(t.secretKey)).toBe(true)
    expect(t.corsOrigins).toEqual(['*'])
    expect(t.plan).toBe('free')

    const row = await service.findById(t.id)
    expect(row!.secretKeyHash).toBe(hashSecret(t.secretKey))
    expect((row as unknown as { secretKey?: string }).secretKey).toBeUndefined()
  })

  it('pk/sk 로 테넌트 해석(교차 거부)', async () => {
    const t = await service.create({ name: 'Acme', corsOrigins: ['https://acme.com'] })
    expect((await service.findByPublishableKey(t.publishableKey))?.id).toBe(t.id)
    expect((await service.findBySecretKey(t.secretKey))?.id).toBe(t.id)
    expect(await service.findByPublishableKey(t.secretKey)).toBeNull()
    expect(await service.findBySecretKey(t.publishableKey)).toBeNull()
    expect(await service.findByPublishableKey('pk_wrong')).toBeNull()
    expect(verifySecret(t.secretKey, (await service.findById(t.id))!.secretKeyHash)).toBe(true)
  })

  it('CORS allowlist — * 모두 허용, 정확 매칭, Origin 없으면 통과', async () => {
    const open = await service.create({ name: 'Open', corsOrigins: ['*'] })
    const openRow = (await service.findById(open.id))!
    expect(service.isOriginAllowed(openRow, 'https://anything.com')).toBe(true)

    const strict = await service.create({ name: 'Strict', corsOrigins: ['https://app.acme.com'] })
    const strictRow = (await service.findById(strict.id))!
    expect(service.isOriginAllowed(strictRow, 'https://app.acme.com')).toBe(true)
    expect(service.isOriginAllowed(strictRow, 'https://evil.com')).toBe(false)
    expect(service.isOriginAllowed(strictRow, undefined)).toBe(true)
  })

  it('키 회전 — 새 pk·sk 발급, 이전 키 무효', async () => {
    const t = await service.create({ name: 'Acme' })
    const rotated = await service.rotateKeys(t.id)
    expect(rotated.publishableKey).not.toBe(t.publishableKey)
    expect(rotated.secretKey).not.toBe(t.secretKey)
    expect(await service.findByPublishableKey(t.publishableKey)).toBeNull()
    expect(await service.findBySecretKey(t.secretKey)).toBeNull()
    expect((await service.findBySecretKey(rotated.secretKey))?.id).toBe(t.id)
  })

  it('설정 수정 — 부분 갱신, 빈 Origin 은 모두 허용으로 정규화', async () => {
    const t = await service.create({ name: 'Acme', corsOrigins: ['https://acme.com'] })
    const renamed = await service.updateSettings(t.id, { name: 'Acme Corp' })
    expect(renamed.name).toBe('Acme Corp')
    expect(renamed.corsOrigins).toEqual(['https://acme.com'])

    const normalized = await service.updateSettings(t.id, { corsOrigins: [] })
    expect(normalized.corsOrigins).toEqual(['*'])
  })

  it('usage — 소비 누적, cap 초과 시 거부', async () => {
    const t = await service.create({ name: 'Acme' })
    expect(await service.tryConsumeMessage(t.id, 1)).toBe(true)
    const usage = await service.getUsage(t.id)
    expect(usage.messages).toBe(1)
    await service.tryConsumeMessage(t.id, usage.cap.messages - 1)
    expect(await service.tryConsumeMessage(t.id, 1)).toBe(false)
  })

  it('멤버 토큰 — 발급·검증 라운드트립, 다른 테넌트 토큰 거부', async () => {
    const t = await service.create({ name: 'Acme' })
    const row = (await service.findById(t.id))!
    const issued = service.issueMemberToken(row, 'alice', 3600)
    expect(issued.token.startsWith('mt_')).toBe(true)
    const payload = service.verifyMemberToken(row, issued.token)
    expect(payload?.sub).toBe('alice')

    // 다른 테넌트의 서명 키로는 검증 실패
    const other = await service.create({ name: 'Other' })
    const otherRow = (await service.findById(other.id))!
    expect(service.verifyMemberToken(otherRow, issued.token)).toBeNull()
  })

  it('방문 ping — pageview 누적 + 고유 방문자 dedupe(같은 visitorId 는 1회)', async () => {
    const t = await service.create({ name: 'Acme' })

    // 같은 방문자가 3번 ping → pageview 3, 고유 방문자 1.
    let r = await service.recordVisit(t.id, { visitorId: 'visitor-1' })
    expect(r.todayPageviews).toBe(1)
    expect(r.todayVisitors).toBe(1)
    await service.recordVisit(t.id, { visitorId: 'visitor-1' })
    r = await service.recordVisit(t.id, { visitorId: 'visitor-1' })
    expect(r.todayPageviews).toBe(3)
    expect(r.todayVisitors).toBe(1)

    // 다른 방문자 → 고유 방문자 2, pageview 4.
    r = await service.recordVisit(t.id, { visitorId: 'visitor-2' })
    expect(r.todayPageviews).toBe(4)
    expect(r.todayVisitors).toBe(2)

    // visitorId 없는 ping → pageview 만 +1, 고유 방문자 유지.
    r = await service.recordVisit(t.id, {})
    expect(r.todayPageviews).toBe(5)
    expect(r.todayVisitors).toBe(2)
  })

  it('분석 — 트래픽(추적값)·가입(실측)을 테넌트 범위로 집계', async () => {
    const t = await service.create({ name: 'Acme' })

    // 임베드 전 — 모든 트래픽 0(정직한 0), 가입도 0.
    let a = await service.getAnalytics(t.id)
    expect(a).toEqual({ todayVisitors: 0, totalTraffic: 0, todaySignups: 0, totalSignups: 0 })

    // 방문 ping 2명(visitor-1 x2, visitor-2 x1) → 오늘 방문자 2, 총 트래픽 3.
    await service.recordVisit(t.id, { visitorId: 'visitor-1' })
    await service.recordVisit(t.id, { visitorId: 'visitor-1' })
    await service.recordVisit(t.id, { visitorId: 'visitor-2' })

    // 대화로 distinct 멤버 등장 — first-seen 이 오늘이므로 today=total.
    const conv = new ConversationsService(dbs, service)
    await conv.create(t.id, { kind: 'dm', memberIds: ['alice', 'bob'] })
    await conv.create(t.id, { kind: 'group', memberIds: ['alice', 'carol'] })

    a = await service.getAnalytics(t.id)
    expect(a.todayVisitors).toBe(2)
    expect(a.totalTraffic).toBe(3)
    // distinct 멤버: alice, bob, carol = 3.
    expect(a.totalSignups).toBe(3)
    expect(a.todaySignups).toBe(3)

    // 다른 테넌트는 격리 — 위 활동에 영향 없음.
    const other = await service.create({ name: 'Other' })
    expect(await service.getAnalytics(other.id)).toEqual({
      todayVisitors: 0,
      totalTraffic: 0,
      todaySignups: 0,
      totalSignups: 0,
    })
  })

  it('분석 — 가입 today 는 오늘 first-seen 만, 과거 멤버는 total 에만 반영', async () => {
    const t = await service.create({ name: 'Acme' })
    const conv = new ConversationsService(dbs, service)

    // 어제 등장한 멤버(대화 created_at 을 과거로 강제).
    const old = await conv.create(t.id, { kind: 'dm', memberIds: ['oldA', 'oldB'] })
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000)
    await dbs.db
      .update(schema.conversations)
      .set({ createdAt: yesterday })
      .where(eq(schema.conversations.id, old.id))

    // 오늘 등장한 새 멤버.
    await conv.create(t.id, { kind: 'dm', memberIds: ['newToday', 'oldA'] })

    const a = await service.getAnalytics(t.id)
    // distinct: oldA, oldB, newToday = 3.
    expect(a.totalSignups).toBe(3)
    // 오늘 first-seen 은 newToday 만(oldA 의 first-seen 은 어제 대화).
    expect(a.todaySignups).toBe(1)
  })
})
