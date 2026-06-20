import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { NotFoundException } from '@nestjs/common'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DatabaseService } from '../db/database.service'
import { organizations, providerProfiles, providerReviews, serviceRequests } from '../db/schema'

import { PublicProvidersService } from './public-providers.service'

import type { AppConfig } from '../config'

const testConfig = (dir: string): AppConfig => ({
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

describe('PublicProvidersService', () => {
  let dir: string
  let dbs: DatabaseService
  let service: PublicProvidersService
  let orgId: string
  let providerUserId: string
  let providerId: string
  let inactiveProviderId: string

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'termsdesk-public-providers-'))
    dbs = new DatabaseService(testConfig(dir))
    await dbs.onModuleInit()
    service = new PublicProvidersService(dbs)

    orgId = randomUUID()
    providerUserId = randomUUID()
    const requestId = randomUUID()
    await dbs.db.insert(organizations).values({ id: orgId, name: '전문가사', slug: 'experts-co' })
    const [profile] = await dbs.db
      .insert(providerProfiles)
      .values({
        userId: providerUserId,
        orgId,
        displayName: '김전문',
        headline: '개인정보·약관 검토',
        bio: '스타트업 개인정보처리방침과 이용약관을 주로 검토합니다.',
        specialties: 'privacy,terms',
        jurisdictions: 'KR',
        hourlyRate: 180_000,
        contact: 'hidden@example.com',
        verified: true,
        active: true,
        completedCount: 7,
        updatedAt: new Date('2026-06-19T00:00:00Z'),
      })
      .returning()
    providerId = profile!.id

    await dbs.db.insert(serviceRequests).values({
      id: requestId,
      requesterOrgId: orgId,
      requesterUserId: randomUUID(),
      requesterName: '의뢰자',
      title: '개인정보처리방침 검토',
      description: '후기 연결용 완료 의뢰입니다.',
      status: 'completed',
    })
    await dbs.db.insert(providerReviews).values({
      providerUserId,
      requestId,
      reviewerName: '의뢰자',
      rating: 5,
      comment: '검토 기준이 명확했습니다.',
    })

    const [inactive] = await dbs.db
      .insert(providerProfiles)
      .values({
        userId: randomUUID(),
        orgId,
        displayName: '비공개 전문가',
        headline: '숨김',
        bio: '비활성 프로필입니다.',
        specialties: 'terms',
        active: false,
        contact: 'private@example.com',
      })
      .returning()
    inactiveProviderId = inactive!.id
  })

  afterEach(async () => {
    await dbs.onModuleDestroy()
    rmSync(dir, { recursive: true, force: true })
  })

  it('active 전문가만 공개 목록에 노출하고 contact 를 숨긴다', async () => {
    const list = await service.list()

    expect(list.total).toBe(1)
    expect(list.items[0]?.id).toBe(providerId)
    expect(list.items[0]?.contact).toBeNull()
    expect(list.items[0]?.avgRating).toBe(5)
    expect(list.items[0]?.reviewCount).toBe(1)
  })

  it('전문 분야 필터와 공개 상세 후기가 동작한다', async () => {
    await expect(service.list({ specialty: 'custom' })).resolves.toMatchObject({ total: 0 })
    const filtered = await service.list({ specialty: 'privacy' })
    expect(filtered.total).toBe(1)

    const detail = await service.get(providerId)
    expect(detail.contact).toBeNull()
    expect(detail.reviews?.[0]).toMatchObject({
      requestTitle: '개인정보처리방침 검토',
      rating: 5,
      comment: '검토 기준이 명확했습니다.',
    })
  })

  it('비활성 또는 잘못된 id 는 동일하게 404 로 숨긴다', async () => {
    await expect(service.get('not-a-uuid')).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.get(inactiveProviderId)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.get(randomUUID())).rejects.toBeInstanceOf(NotFoundException)
  })

  it('sitemap 은 공개 디렉터리와 active 전문가 URL 만 생성한다', async () => {
    const entries = await service.sitemapEntries()

    expect(entries.some((entry) => entry.loc.endsWith('/experts'))).toBe(true)
    expect(entries.some((entry) => entry.loc.endsWith(`/experts/${providerId}`))).toBe(true)
    expect(entries).toHaveLength(2)
  })
})
