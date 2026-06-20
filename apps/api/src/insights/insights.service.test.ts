import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DatabaseService } from '../db/database.service'
import {
  apiKeys,
  auditEvents,
  consentReceipts,
  organizations,
  policies,
  policyVersions,
} from '../db/schema'

import { InsightsService } from './insights.service'

import type { AppConfig } from '../config'

const DAY = 86_400_000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY)
const utcDayKey = (d: Date) => d.toISOString().slice(0, 10)

describe('InsightsService (pglite)', () => {
  let dir: string
  let dbs: DatabaseService
  let service: InsightsService
  let orgId: string

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'termsdesk-insights-'))
    dbs = new DatabaseService({
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
    } satisfies AppConfig)
    await dbs.onModuleInit()
    service = new InsightsService(dbs)

    orgId = randomUUID()
    await dbs.db.insert(organizations).values({ id: orgId, name: 'Acme', slug: 'acme' })
  })

  afterEach(async () => {
    await dbs.onModuleDestroy()
    rmSync(dir, { recursive: true, force: true })
  })

  /** 게시본 1개(currentVersionId 연결)를 가진 정책 생성 — 영수증 FK·현재 해시 기준점. */
  async function seedPolicy(slug: string, contentHash: string) {
    const policyId = randomUUID()
    const versionId = randomUUID()
    await dbs.db.insert(policies).values({ id: policyId, orgId, slug, name: slug })
    await dbs.db.insert(policyVersions).values({
      id: versionId,
      orgId,
      policyId,
      versionNumber: 1,
      versionLabel: 'v1',
      title: slug,
      body: `${slug} 본문`,
      contentHash,
      status: 'published',
      publishedAt: new Date(),
    })
    await dbs.db
      .update(policies)
      .set({ currentVersionId: versionId })
      .where(eq(policies.id, policyId))
    return { policyId, versionId }
  }

  async function receipt(input: {
    policyId: string
    versionId: string
    subjectRef: string
    contentHash: string
    decision?: string
    createdAt?: Date
  }) {
    await dbs.db.insert(consentReceipts).values({
      id: randomUUID(),
      orgId,
      policyId: input.policyId,
      policyVersionId: input.versionId,
      contentHash: input.contentHash,
      subjectRef: input.subjectRef,
      decision: input.decision ?? 'accepted',
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    })
  }

  describe('consentTrend', () => {
    it('최근 30일을 일자 버킷으로 집계하고 빈 날은 0으로 채운다 (윈도 밖 제외)', async () => {
      const { policyId, versionId } = await seedPolicy('terms', 'hash-t1')

      await receipt({ policyId, versionId, subjectRef: 's1', contentHash: 'hash-t1' })
      await receipt({ policyId, versionId, subjectRef: 's2', contentHash: 'hash-t1' })
      await receipt({
        policyId,
        versionId,
        subjectRef: 's3',
        contentHash: 'hash-t1',
        decision: 'declined',
      })
      await receipt({
        policyId,
        versionId,
        subjectRef: 's4',
        contentHash: 'hash-t1',
        createdAt: daysAgo(3),
      })
      // 윈도(30일) 밖 — 집계 제외 검증
      await receipt({
        policyId,
        versionId,
        subjectRef: 's5',
        contentHash: 'hash-t1',
        createdAt: daysAgo(40),
      })

      const points = await service.consentTrend(orgId, 30)

      expect(points).toHaveLength(30)
      // 연속·오름차순(zero-fill)
      expect(points[0]!.date < points[29]!.date).toBe(true)

      const today = points[29]!
      expect(today.date).toBe(utcDayKey(new Date()))
      expect(today.accepted).toBe(2)
      expect(today.declined).toBe(1)
      expect(today.total).toBe(3)

      const d3 = points.find((p) => p.date === utcDayKey(daysAgo(3)))
      expect(d3?.accepted).toBe(1)

      const sum = points.reduce((acc, p) => acc + p.total, 0)
      expect(sum).toBe(4) // 40일 전 영수증은 제외
    })

    it('days 파라미터를 7~90 으로 클램프한다', async () => {
      expect(await service.consentTrend(orgId, 7)).toHaveLength(7)
      expect(await service.consentTrend(orgId, 1)).toHaveLength(7)
      expect(await service.consentTrend(orgId, 365)).toHaveLength(90)
    })

    it('영수증이 없는 신규 조직은 전부 0 인 30개 포인트를 돌려준다', async () => {
      const points = await service.consentTrend(orgId, 30)
      expect(points).toHaveLength(30)
      expect(points.every((p) => p.total === 0)).toBe(true)
    })
  })

  describe('reconsentStatus', () => {
    it('현재 게시본 해시에 accepted 영수증이 없는 subjectRef 를 재동의 대상으로 센다', async () => {
      const { policyId, versionId } = await seedPolicy('terms', 'hash-v2')

      // s1: 현재 해시 동의 → 재동의 불필요
      await receipt({ policyId, versionId, subjectRef: 's1', contentHash: 'hash-v2' })
      // s2: 옛 해시 동의만 → 재동의 필요
      await receipt({ policyId, versionId, subjectRef: 's2', contentHash: 'hash-v1' })
      // s3: 현재 해시지만 declined → 재동의 필요
      await receipt({
        policyId,
        versionId,
        subjectRef: 's3',
        contentHash: 'hash-v2',
        decision: 'declined',
      })

      const rows = await service.reconsentStatus(orgId)
      expect(rows).toHaveLength(1)
      const row = rows[0]!
      expect(row.policySlug).toBe('terms')
      expect(row.currentVersionLabel).toBe('v1')
      expect(row.totalSubjects).toBe(3)
      expect(row.acceptedCurrent).toBe(1)
      expect(row.pendingReconsent).toBe(2)
    })

    it('게시본 없는 정책은 제외하고, 영수증 0건 정책은 0으로 보고한다', async () => {
      // 게시본 없는 정책(미게시) — 목록 제외
      await dbs.db
        .insert(policies)
        .values({ id: randomUUID(), orgId, slug: 'draft-only', name: '미게시' })
      // 게시본은 있으나 영수증 없음 — 0/0/0
      await seedPolicy('privacy', 'hash-p1')

      const rows = await service.reconsentStatus(orgId)
      expect(rows).toHaveLength(1)
      expect(rows[0]!.policySlug).toBe('privacy')
      expect(rows[0]!.totalSubjects).toBe(0)
      expect(rows[0]!.pendingReconsent).toBe(0)
    })

    it('다른 조직 데이터는 섞이지 않는다', async () => {
      const otherOrg = randomUUID()
      await dbs.db.insert(organizations).values({ id: otherOrg, name: 'Other', slug: 'other' })
      expect(await service.reconsentStatus(otherOrg)).toHaveLength(0)
    })
  })

  describe('apiKeyUsage', () => {
    it('키 목록(최근 사용 우선)과 audit_events 30일 consent.recorded 집계를 돌려준다', async () => {
      await dbs.db.insert(apiKeys).values({
        id: randomUUID(),
        orgId,
        name: 'unused-key',
        keyPrefix: 'td_aaa',
        keyHash: `h-${randomUUID()}`,
      })
      await dbs.db.insert(apiKeys).values({
        id: randomUUID(),
        orgId,
        name: 'active-key',
        keyPrefix: 'td_bbb',
        keyHash: `h-${randomUUID()}`,
        lastUsedAt: daysAgo(1),
      })

      const audit = (action: string, createdAt: Date) =>
        dbs.db.insert(auditEvents).values({
          id: randomUUID(),
          orgId,
          action,
          targetType: 'consent_receipt',
          createdAt,
        })
      await audit('consent.recorded', daysAgo(1))
      await audit('consent.recorded', daysAgo(5))
      await audit('consent.recorded', daysAgo(40)) // 윈도 밖
      await audit('policy.updated', daysAgo(1)) // 다른 액션

      const usage = await service.apiKeyUsage(orgId)
      expect(usage.keys.map((k) => k.name)).toEqual(['active-key', 'unused-key'])
      expect(usage.keys[0]!.lastUsedAt).not.toBeNull()
      expect(usage.consentWrites30d).toBe(2)
    })

    it('키가 없는 신규 조직은 빈 목록 + 0 을 돌려준다', async () => {
      const usage = await service.apiKeyUsage(orgId)
      expect(usage.keys).toEqual([])
      expect(usage.consentWrites30d).toBe(0)
    })
  })
})
