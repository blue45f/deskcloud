import { PGlite } from '@electric-sql/pglite'
import { ForbiddenException, HttpException, NotFoundException } from '@nestjs/common'
import { FREE_PLAN_LIMIT } from '@reviewdesk/shared'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { TenantsService, type TenantRow } from '../tenants/tenants.service'

import { ReviewsService } from './reviews.service'

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
}

async function setup(): Promise<{
  dbs: DatabaseService
  tenants: TenantsService
  reviews: ReviewsService
}> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  const tenants = new TenantsService(dbs)
  const reviews = new ReviewsService(dbs, tenants, cfg)
  return { dbs, tenants, reviews }
}

async function makeTenant(
  tenants: TenantsService,
  over: { autoApprove?: boolean; plan?: 'free' | 'pro' } = {}
): Promise<TenantRow> {
  const res = await tenants.createTenant({
    name: 'T',
    corsOrigins: ['*'],
    autoApprove: over.autoApprove ?? false,
  })
  const row = (await tenants.findById(res.tenant.id))!
  if (over.plan) {
    await tenants.updateTenant(row.id, { plan: over.plan })
    return (await tenants.findById(row.id))!
  }
  return row
}

const baseReview = {
  subjectId: 'pro-plan',
  rating: 5,
  body: '정말 좋아요',
  authorName: '홍길동',
} as const

describe('ReviewsService (PGlite)', () => {
  let dbs: DatabaseService
  let tenants: TenantsService
  let reviews: ReviewsService

  beforeEach(async () => {
    ;({ dbs, tenants, reviews } = await setup())
  })

  it('제출은 기본 pending, autoApprove 테넌트는 approved', async () => {
    const t1 = await makeTenant(tenants, { autoApprove: false })
    const r1 = await reviews.submitReview(t1, { ...baseReview })
    expect(r1.status).toBe('pending')

    const t2 = await makeTenant(tenants, { autoApprove: true })
    const r2 = await reviews.submitReview(t2, { ...baseReview })
    expect(r2.status).toBe('approved')
  })

  it('제출 시 usageCount 가 증가', async () => {
    const t = await makeTenant(tenants)
    await reviews.submitReview(t, { ...baseReview })
    await reviews.submitReview(t, { ...baseReview })
    const after = (await tenants.findById(t.id))!
    expect(after.usageCount).toBe(2)
  })

  it('무료 플랜 소프트 한도 초과 시 402', async () => {
    const t = await makeTenant(tenants, { plan: 'free' })
    // usageCount 를 한도까지 올린다.
    await dbs.db
      .update(schema.tenants)
      .set({ usageCount: cfg.freePlanLimit })
      .where(eq(schema.tenants.id, t.id))
    const atLimit = (await tenants.findById(t.id))!
    await expect(reviews.submitReview(atLimit, { ...baseReview })).rejects.toBeInstanceOf(
      HttpException
    )
  })

  it('pro 플랜은 한도 무관하게 제출 가능', async () => {
    const t = await makeTenant(tenants, { plan: 'pro' })
    await dbs.db
      .update(schema.tenants)
      .set({ usageCount: cfg.freePlanLimit + 100 })
      .where(eq(schema.tenants.id, t.id))
    const overLimit = (await tenants.findById(t.id))!
    const r = await reviews.submitReview(overLimit, { ...baseReview })
    expect(r.id).toBeTruthy()
  })

  it('공개 목록은 승인본만 노출하고 집계를 포함', async () => {
    const t = await makeTenant(tenants, { autoApprove: false })
    const pending = await reviews.submitReview(t, { ...baseReview, rating: 1 })
    const approve = await reviews.submitReview(t, { ...baseReview, rating: 5 })
    await reviews.moderate(t, approve.id, { action: 'approve' })

    const pub = await reviews.getPublicReviews(t, 'pro-plan')
    // pending 1건은 안 보이고 approved 1건만
    expect(pub.items).toHaveLength(1)
    expect(pub.items.every((i) => i.id !== pending.id)).toBe(true)
    // 집계도 승인본(별점 5) 기준
    expect(pub.aggregate.count).toBe(1)
    expect(pub.aggregate.avgRating).toBe(5)
  })

  it('공개 DTO 는 비공개 필드(authorEmail)를 노출하지 않음', async () => {
    const t = await makeTenant(tenants, { autoApprove: true })
    await reviews.submitReview(t, { ...baseReview, authorEmail: 'secret@example.com' })
    const pub = await reviews.getPublicReviews(t, 'pro-plan')
    expect(pub.items[0]).not.toHaveProperty('authorEmail')
    expect(pub.items[0]).not.toHaveProperty('meta')
  })

  it('검수 상태 전이: pending → approved → rejected', async () => {
    const t = await makeTenant(tenants)
    const r = await reviews.submitReview(t, { ...baseReview })

    await reviews.moderate(t, r.id, { action: 'approve' })
    let list = await reviews.listReviews(t, { status: 'approved' })
    expect(list.total).toBe(1)

    await reviews.moderate(t, r.id, { action: 'reject' })
    list = await reviews.listReviews(t, { status: 'rejected' })
    expect(list.total).toBe(1)
    list = await reviews.listReviews(t, { status: 'approved' })
    expect(list.total).toBe(0)
  })

  it('feature 는 승인본에만 가능, reject 하면 featured 해제', async () => {
    const t = await makeTenant(tenants)
    const r = await reviews.submitReview(t, { ...baseReview })

    // pending 상태에서 feature 시도 → 403
    await expect(reviews.moderate(t, r.id, { action: 'feature' })).rejects.toBeInstanceOf(
      ForbiddenException
    )

    await reviews.moderate(t, r.id, { action: 'approve' })
    await reviews.moderate(t, r.id, { action: 'feature' })

    const wall = await reviews.getWall(t)
    expect(wall.items).toHaveLength(1)

    // reject 하면 featured 가 내려가 월에서 사라짐
    await reviews.moderate(t, r.id, { action: 'reject' })
    const wall2 = await reviews.getWall(t)
    expect(wall2.items).toHaveLength(0)
  })

  it('reply 액션이 답글을 달고, 빈 문자열이면 삭제', async () => {
    const t = await makeTenant(tenants, { autoApprove: true })
    const r = await reviews.submitReview(t, { ...baseReview })
    await reviews.moderate(t, r.id, { action: 'reply', reply: '감사합니다!' })
    let pub = await reviews.getPublicReviews(t, 'pro-plan')
    expect(pub.items[0]!.reply).toBe('감사합니다!')

    await reviews.moderate(t, r.id, { action: 'reply', reply: '' })
    pub = await reviews.getPublicReviews(t, 'pro-plan')
    expect(pub.items[0]!.reply).toBeNull()
  })

  it('삭제 후 목록에서 사라짐', async () => {
    const t = await makeTenant(tenants)
    const r = await reviews.submitReview(t, { ...baseReview })
    await reviews.deleteReview(t, r.id)
    const list = await reviews.listReviews(t, {})
    expect(list.total).toBe(0)
  })

  it('타 테넌트의 리뷰는 검수/삭제 불가(404)', async () => {
    const t1 = await makeTenant(tenants)
    const t2 = await makeTenant(tenants)
    const r = await reviews.submitReview(t1, { ...baseReview })
    await expect(reviews.moderate(t2, r.id, { action: 'approve' })).rejects.toBeInstanceOf(
      NotFoundException
    )
    await expect(reviews.deleteReview(t2, r.id)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('어드민 목록 페이지네이션(offset/limit)', async () => {
    const t = await makeTenant(tenants)
    for (let i = 0; i < 5; i += 1) await reviews.submitReview(t, { ...baseReview })
    const page = await reviews.listReviews(t, { offset: 2, limit: 2 })
    expect(page.total).toBe(5)
    expect(page.items).toHaveLength(2)
    expect(page.offset).toBe(2)
  })

  it('wall 은 다른 테넌트의 추천 리뷰를 섞지 않음(테넌트 격리)', async () => {
    const t1 = await makeTenant(tenants, { autoApprove: true })
    const t2 = await makeTenant(tenants, { autoApprove: true })
    const r1 = await reviews.submitReview(t1, { ...baseReview })
    await reviews.moderate(t1, r1.id, { action: 'feature' })
    const r2 = await reviews.submitReview(t2, { ...baseReview })
    await reviews.moderate(t2, r2.id, { action: 'feature' })

    expect((await reviews.getWall(t1)).items).toHaveLength(1)
    expect((await reviews.getWall(t2)).items).toHaveLength(1)
  })
})
