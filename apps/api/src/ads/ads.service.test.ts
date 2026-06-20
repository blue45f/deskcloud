import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { loadConfig, type AppConfig } from '../config'
import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { TenantsService } from '../tenants/tenants.service'

import { AdsService } from './ads.service'

import type { Database, DatabaseService } from '../db/database.service'

interface Harness {
  ads: AdsService
  tenants: TenantsService
  tenantId: string
  plan: string
}

async function makeHarness(overrides: Partial<AppConfig> = {}): Promise<Harness> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  const cfg: AppConfig = { ...loadConfig(), keyPepper: 'it-pepper', ...overrides }
  const tenants = new TenantsService(dbs, cfg)
  const ads = new AdsService(dbs, tenants, cfg)
  const creds = await tenants.signup({ name: 'Acme', corsOrigins: ['*'] })
  return { ads, tenants, tenantId: creds.tenant.id, plan: creds.tenant.plan }
}

describe('AdsService — 캠페인/크리에이티브/슬롯 CRUD (PGlite)', () => {
  let h: Harness
  beforeEach(async () => {
    h = await makeHarness()
  })

  it('캠페인 생성·조회·수정·삭제', async () => {
    const c = await h.ads.createCampaign(h.tenantId, { name: '여름', status: 'active' })
    expect(c.name).toBe('여름')
    expect(c.status).toBe('active')

    const fetched = await h.ads.getCampaign(h.tenantId, c.id)
    expect(fetched.id).toBe(c.id)

    const updated = await h.ads.updateCampaign(h.tenantId, c.id, { status: 'paused' })
    expect(updated.status).toBe('paused')

    const list = await h.ads.listCampaigns(h.tenantId)
    expect(list).toHaveLength(1)

    const del = await h.ads.deleteCampaign(h.tenantId, c.id)
    expect(del.deleted).toBe(true)
    expect(await h.ads.listCampaigns(h.tenantId)).toHaveLength(0)
  })

  it('캠페인 삭제 시 소속 크리에이티브도 제거', async () => {
    await h.ads.createSlot(h.tenantId, { key: 'sidebar', sizes: ['300x250'] })
    const c = await h.ads.createCampaign(h.tenantId, { name: 'X', status: 'active' })
    await h.ads.createCreative(h.tenantId, {
      campaignId: c.id,
      slotKey: 'sidebar',
      imageUrl: 'https://cdn.example/a.png',
      linkUrl: 'https://shop.example',
      alt: 'A',
      weight: 1,
    })
    expect(await h.ads.listCreatives(h.tenantId)).toHaveLength(1)
    await h.ads.deleteCampaign(h.tenantId, c.id)
    expect(await h.ads.listCreatives(h.tenantId)).toHaveLength(0)
  })

  it('없는 slotKey 로 크리에이티브를 만들 수 없다(400)', async () => {
    const c = await h.ads.createCampaign(h.tenantId, { name: 'X', status: 'active' })
    await expect(
      h.ads.createCreative(h.tenantId, {
        campaignId: c.id,
        slotKey: 'ghost-slot',
        imageUrl: 'https://cdn.example/a.png',
        linkUrl: 'https://shop.example',
        alt: 'A',
        weight: 1,
      })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('크리에이티브를 없는 slotKey 로 이동(수정)할 수 없다(400)', async () => {
    await h.ads.createSlot(h.tenantId, { key: 'sidebar', sizes: ['300x250'] })
    const c = await h.ads.createCampaign(h.tenantId, { name: 'X', status: 'active' })
    const cr = await h.ads.createCreative(h.tenantId, {
      campaignId: c.id,
      slotKey: 'sidebar',
      imageUrl: 'https://cdn.example/a.png',
      linkUrl: 'https://shop.example',
      alt: 'A',
      weight: 1,
    })
    await expect(
      h.ads.updateCreative(h.tenantId, cr.id, { slotKey: 'ghost-slot' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('다른 테넌트의 캠페인에는 크리에이티브를 만들 수 없다(404)', async () => {
    const other = await makeHarness()
    const c = await other.ads.createCampaign(other.tenantId, { name: 'O', status: 'active' })
    await expect(
      h.ads.createCreative(h.tenantId, {
        campaignId: c.id,
        slotKey: 'sidebar',
        imageUrl: 'https://cdn.example/a.png',
        linkUrl: 'https://shop.example',
        alt: 'A',
        weight: 1,
      })
    ).rejects.toThrow()
  })

  it('슬롯 생성 — 중복 key 거절', async () => {
    const s = await h.ads.createSlot(h.tenantId, { key: 'sidebar', sizes: ['300x250'] })
    expect(s.key).toBe('sidebar')
    await expect(
      h.ads.createSlot(h.tenantId, { key: 'sidebar', sizes: ['300x250'] })
    ).rejects.toThrow()
  })
})

describe('AdsService — 서빙(가중치·서빙가능성·소프트캡)', () => {
  let h: Harness
  beforeEach(async () => {
    h = await makeHarness()
  })

  /** active 캠페인 + 슬롯 + 크리에이티브 N개를 만든다. */
  async function seedServable(weights: number[]): Promise<string[]> {
    await h.ads.createSlot(h.tenantId, { key: 'sidebar', sizes: ['300x250'] })
    const campaign = await h.ads.createCampaign(h.tenantId, { name: 'C', status: 'active' })
    const ids: string[] = []
    for (const w of weights) {
      const cr = await h.ads.createCreative(h.tenantId, {
        campaignId: campaign.id,
        slotKey: 'sidebar',
        imageUrl: 'https://cdn.example/a.png',
        linkUrl: 'https://shop.example',
        alt: 'banner',
        weight: w,
      })
      ids.push(cr.id)
    }
    return ids
  }

  it('후보가 없으면 served:false', async () => {
    const out = await h.ads.serve({ id: h.tenantId, plan: h.plan, usageCount: 0 }, 'sidebar')
    expect(out.served).toBe(false)
    expect(out.creativeId).toBeNull()
  })

  it('주입한 rng 로 가중 크리에이티브를 결정적으로 선택', async () => {
    const [a, b] = await seedServable([1, 3]) // total 4, a:[0,1) b:[1,4)
    const tenant = { id: h.tenantId, plan: h.plan, usageCount: 0 }
    const pickA = await h.ads.serve(tenant, 'sidebar', () => 0.1) // 0.4 → a
    expect(pickA.creativeId).toBe(a)
    const pickB = await h.ads.serve(tenant, 'sidebar', () => 0.5) // 2.0 → b
    expect(pickB.creativeId).toBe(b)
  })

  it('서빙 응답에 슬롯 첫 사이즈를 size 힌트로 담는다', async () => {
    await seedServable([1])
    const out = await h.ads.serve(
      { id: h.tenantId, plan: h.plan, usageCount: 0 },
      'sidebar',
      () => 0
    )
    expect(out.served).toBe(true)
    expect(out.size).toBe('300x250')
  })

  it('paused 캠페인의 크리에이티브는 서빙하지 않는다', async () => {
    await h.ads.createSlot(h.tenantId, { key: 'sidebar', sizes: ['300x250'] })
    const campaign = await h.ads.createCampaign(h.tenantId, { name: 'P', status: 'paused' })
    await h.ads.createCreative(h.tenantId, {
      campaignId: campaign.id,
      slotKey: 'sidebar',
      imageUrl: 'https://cdn.example/a.png',
      linkUrl: 'https://shop.example',
      alt: 'banner',
      weight: 1,
    })
    const out = await h.ads.serve({ id: h.tenantId, plan: h.plan, usageCount: 0 }, 'sidebar')
    expect(out.served).toBe(false)
  })

  it('서빙되면 테넌트 usageCount 가 증가한다', async () => {
    await seedServable([1])
    await h.ads.serve({ id: h.tenantId, plan: h.plan, usageCount: 0 }, 'sidebar', () => 0)
    const row = await h.tenants.findById(h.tenantId)
    expect(row?.usageCount).toBe(1)
  })

  it('빈 응답(served:false)은 usageCount 를 올리지 않는다', async () => {
    await h.ads.serve({ id: h.tenantId, plan: h.plan, usageCount: 0 }, 'sidebar')
    const row = await h.tenants.findById(h.tenantId)
    expect(row?.usageCount).toBe(0)
  })

  it('무료 플랜 소프트 한도를 초과하면 402', async () => {
    const capped = await makeHarness({ freePlanLimit: 5 })
    await capped.ads.createSlot(capped.tenantId, { key: 'sidebar', sizes: ['300x250'] })
    await expect(
      capped.ads.serve({ id: capped.tenantId, plan: 'free', usageCount: 5 }, 'sidebar')
    ).rejects.toMatchObject({ status: 402 })
  })

  it('한도를 원자적으로 강제 — DB 가 이미 한도면 402(스냅샷이 낡아도 오버슈트 없음)', async () => {
    const capped = await makeHarness({ freePlanLimit: 1 })
    // 슬롯 + active 크리에이티브 1개(서빙 가능 후보).
    await capped.ads.createSlot(capped.tenantId, { key: 'sidebar', sizes: ['300x250'] })
    const camp = await capped.ads.createCampaign(capped.tenantId, { name: 'C', status: 'active' })
    await capped.ads.createCreative(capped.tenantId, {
      campaignId: camp.id,
      slotKey: 'sidebar',
      imageUrl: 'https://cdn.example/a.png',
      linkUrl: 'https://shop.example',
      alt: 'banner',
      weight: 1,
    })
    // 첫 서빙: usageCount 0 → 1(한도 도달).
    const first = await capped.ads.serve(
      { id: capped.tenantId, plan: 'free', usageCount: 0 },
      'sidebar',
      () => 0
    )
    expect(first.served).toBe(true)
    // 두 번째: 낡은 스냅샷(usageCount:0)을 줘도 원자적 조건부 증가가 0행이라 402.
    await expect(
      capped.ads.serve({ id: capped.tenantId, plan: 'free', usageCount: 0 }, 'sidebar', () => 0)
    ).rejects.toMatchObject({ status: 402 })
    // 카운터는 한도(1)에서 멈춰 있어야 한다(오버슈트 없음).
    const row = await capped.tenants.findById(capped.tenantId)
    expect(row?.usageCount).toBe(1)
  })
})

describe('AdsService — 추적·통계', () => {
  let h: Harness
  beforeEach(async () => {
    h = await makeHarness()
  })

  it('노출/클릭 추적이 카운터를 증가시킨다', async () => {
    await h.ads.createSlot(h.tenantId, { key: 'sidebar', sizes: ['300x250'] })
    const campaign = await h.ads.createCampaign(h.tenantId, { name: 'C', status: 'active' })
    const cr = await h.ads.createCreative(h.tenantId, {
      campaignId: campaign.id,
      slotKey: 'sidebar',
      imageUrl: 'https://cdn.example/a.png',
      linkUrl: 'https://shop.example',
      alt: 'banner',
      weight: 1,
    })
    expect((await h.ads.trackImpression(h.tenantId, cr.id)).count).toBe(1)
    expect((await h.ads.trackImpression(h.tenantId, cr.id)).count).toBe(2)
    expect((await h.ads.trackClick(h.tenantId, cr.id)).count).toBe(1)
  })

  it('봇 User-Agent 의 노출/클릭은 카운터를 올리지 않는다(IVT 필터)', async () => {
    await h.ads.createSlot(h.tenantId, { key: 'sidebar', sizes: ['300x250'] })
    const campaign = await h.ads.createCampaign(h.tenantId, { name: 'C', status: 'active' })
    const cr = await h.ads.createCreative(h.tenantId, {
      campaignId: campaign.id,
      slotKey: 'sidebar',
      imageUrl: 'https://cdn.example/a.png',
      linkUrl: 'https://shop.example',
      alt: 'banner',
      weight: 1,
    })
    // 봇 UA — 영수증은 200 으로 돌아오지만 카운터는 0 유지.
    expect((await h.ads.trackImpression(h.tenantId, cr.id, 'Googlebot/2.1')).count).toBe(0)
    expect((await h.ads.trackClick(h.tenantId, cr.id, 'curl/8.4.0')).count).toBe(0)
    // 사람 UA 면 증가.
    expect((await h.ads.trackImpression(h.tenantId, cr.id, 'Mozilla/5.0 Chrome/124')).count).toBe(1)
    // 봇이라도 없는 크리에이티브면 404.
    await expect(
      h.ads.trackImpression(h.tenantId, '11111111-1111-4111-8111-111111111111', 'bot')
    ).rejects.toMatchObject({ status: 404 })
  })

  it('없는 크리에이티브 추적은 404', async () => {
    await expect(
      h.ads.trackImpression(h.tenantId, '11111111-1111-4111-8111-111111111111')
    ).rejects.toThrow()
  })

  it('통계 — 캠페인별 노출/클릭/CTR + 합계', async () => {
    await h.ads.createSlot(h.tenantId, { key: 'sidebar', sizes: ['300x250'] })
    await h.ads.createSlot(h.tenantId, { key: 'feed', sizes: ['728x90'] })
    const c1 = await h.ads.createCampaign(h.tenantId, { name: 'A', status: 'active' })
    const c2 = await h.ads.createCampaign(h.tenantId, { name: 'B', status: 'active' })
    const cr1 = await h.ads.createCreative(h.tenantId, {
      campaignId: c1.id,
      slotKey: 'sidebar',
      imageUrl: 'https://cdn.example/a.png',
      linkUrl: 'https://shop.example',
      alt: 'a',
      weight: 1,
    })
    const cr2 = await h.ads.createCreative(h.tenantId, {
      campaignId: c2.id,
      slotKey: 'feed',
      imageUrl: 'https://cdn.example/b.png',
      linkUrl: 'https://shop.example',
      alt: 'b',
      weight: 1,
    })
    // c1: 100 imp / 10 click, c2: 400 imp / 8 click
    for (let i = 0; i < 100; i += 1) await h.ads.trackImpression(h.tenantId, cr1.id)
    for (let i = 0; i < 10; i += 1) await h.ads.trackClick(h.tenantId, cr1.id)
    for (let i = 0; i < 400; i += 1) await h.ads.trackImpression(h.tenantId, cr2.id)
    for (let i = 0; i < 8; i += 1) await h.ads.trackClick(h.tenantId, cr2.id)

    const stats = await h.ads.stats(h.tenantId)
    // 노출 내림차순 정렬: B(400) 먼저
    expect(stats.campaigns[0]?.campaignName).toBe('B')
    expect(stats.campaigns[0]?.ctr).toBe(2) // 8/400
    expect(stats.campaigns[1]?.ctr).toBe(10) // 10/100
    expect(stats.totals.impressions).toBe(500)
    expect(stats.totals.clicks).toBe(18)
    expect(stats.totals.ctr).toBe(3.6) // 18/500
  })
})

describe('AdsService — 트래픽/분석 집계(방문·가입)', () => {
  let h: Harness
  beforeEach(async () => {
    h = await makeHarness()
  })

  /** 슬롯 + active 캠페인 + 크리에이티브 1개를 만든다(서빙 가능 후보). */
  async function seedOne(): Promise<void> {
    await h.ads.createSlot(h.tenantId, { key: 'sidebar', sizes: ['300x250'] })
    const c = await h.ads.createCampaign(h.tenantId, { name: 'C', status: 'active' })
    await h.ads.createCreative(h.tenantId, {
      campaignId: c.id,
      slotKey: 'sidebar',
      imageUrl: 'https://cdn.example/a.png',
      linkUrl: 'https://shop.example',
      alt: 'banner',
      weight: 1,
    })
  }

  it('서빙 성공이 오늘 방문 버킷을 누적한다(totals.todayVisits)', async () => {
    await seedOne()
    const tenant = { id: h.tenantId, plan: h.plan, usageCount: 0 }
    await h.ads.serve(tenant, 'sidebar', () => 0)
    await h.ads.serve(tenant, 'sidebar', () => 0)
    const stats = await h.ads.stats(h.tenantId)
    expect(stats.totals.todayVisits).toBe(2)
  })

  it('빈 응답(served:false)은 방문을 누적하지 않는다', async () => {
    // 후보 없는 슬롯 — served:false.
    const stats0 = await h.ads.stats(h.tenantId)
    expect(stats0.totals.todayVisits).toBe(0)
    await h.ads.serve({ id: h.tenantId, plan: h.plan, usageCount: 0 }, 'no-such-slot')
    const stats1 = await h.ads.stats(h.tenantId)
    expect(stats1.totals.todayVisits).toBe(0)
  })

  it('어제 방문은 오늘 카운트에 안 잡힌다(일일 버킷 격리)', async () => {
    await seedOne()
    const tenant = { id: h.tenantId, plan: h.plan, usageCount: 0 }
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await h.ads.serve(tenant, 'sidebar', () => 0, yesterday)
    // 어제 버킷만 있고 오늘은 0.
    const stats = await h.ads.stats(h.tenantId, new Date())
    expect(stats.totals.todayVisits).toBe(0)
  })

  it('총 캠페인/총 크리에이티브 수를 합계에 담는다', async () => {
    await h.ads.createSlot(h.tenantId, { key: 'sidebar', sizes: ['300x250'] })
    const c1 = await h.ads.createCampaign(h.tenantId, { name: 'A', status: 'active' })
    await h.ads.createCampaign(h.tenantId, { name: 'B', status: 'paused' })
    await h.ads.createCreative(h.tenantId, {
      campaignId: c1.id,
      slotKey: 'sidebar',
      imageUrl: 'https://cdn.example/a.png',
      linkUrl: 'https://shop.example',
      alt: 'a',
      weight: 1,
    })
    const stats = await h.ads.stats(h.tenantId)
    expect(stats.totals.totalCampaigns).toBe(2)
    expect(stats.totals.totalCreatives).toBe(1)
  })

  it('오늘 신규 가입(오늘 생성된 캠페인+크리에이티브)을 센다', async () => {
    await h.ads.createSlot(h.tenantId, { key: 'sidebar', sizes: ['300x250'] })
    const c = await h.ads.createCampaign(h.tenantId, { name: 'A', status: 'active' })
    await h.ads.createCreative(h.tenantId, {
      campaignId: c.id,
      slotKey: 'sidebar',
      imageUrl: 'https://cdn.example/a.png',
      linkUrl: 'https://shop.example',
      alt: 'a',
      weight: 1,
    })
    // 1 캠페인 + 1 크리에이티브 = 오늘 2건.
    const stats = await h.ads.stats(h.tenantId, new Date())
    expect(stats.totals.todayNewSignups).toBe(2)
  })
})

describe('AdsService — 이미지 업로드(PGlite)', () => {
  let h: Harness
  beforeEach(async () => {
    h = await makeHarness()
  })

  // 1x1 투명 PNG(base64).
  const PNG_1x1 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQAa6OUbAAAAAElFTkSuQmCC'

  it('업로드 → 저장 → 서빙 조회 라운드트립', async () => {
    const res = await h.ads.createUpload(h.tenantId, { contentType: 'image/png', data: PNG_1x1 })
    expect(res.contentType).toBe('image/png')
    expect(res.bytes).toBeGreaterThan(0)

    const fetched = await h.ads.getUpload(res.id)
    expect(fetched?.contentType).toBe('image/png')
    expect(fetched?.data).toBe(PNG_1x1)
  })

  it('data: URL 형식도 받아 분해 저장', async () => {
    const res = await h.ads.createUpload(h.tenantId, {
      contentType: 'image/png',
      data: `data:image/png;base64,${PNG_1x1}`,
    })
    expect((await h.ads.getUpload(res.id))?.data).toBe(PNG_1x1)
  })

  it('data: URL 형식과 선언 contentType 이 다르면 거절', async () => {
    await expect(
      h.ads.createUpload(h.tenantId, {
        contentType: 'image/png',
        data: `data:image/gif;base64,${PNG_1x1}`,
      })
    ).rejects.toThrow()
  })

  it('2 MiB 초과 거절', async () => {
    const tooBig = 'QQ'.repeat(1_500_000) // 디코딩 ~2.25 MiB > 한도
    await expect(
      h.ads.createUpload(h.tenantId, { contentType: 'image/png', data: tooBig })
    ).rejects.toThrow()
  })

  it('잘못된 id/없는 id 는 null', async () => {
    expect(await h.ads.getUpload('not-a-uuid')).toBeNull()
    expect(await h.ads.getUpload('00000000-0000-4000-8000-000000000000')).toBeNull()
  })
})
