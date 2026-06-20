import { sql } from 'drizzle-orm'

import { hashSecretKey } from '../common/keys'

import { DatabaseService } from './database.service'
import { campaigns, creatives, slots, tenants } from './schema'

const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

/** 데모 테넌트 — 고정 키(pk_demo/sk_demo)로 로컬 검증/문서가 바로 동작하도록. */
const DEMO = {
  name: 'Demo Co',
  slug: 'demo',
  publishableKey: 'pk_demo',
  secretKey: 'sk_demo',
  corsOrigins: ['*'],
} as const

/**
 * 형제 앱(PromptMarket·quote-match·rotifolk·pettography·offhours·proto-live)의
 * SponsoredX 레일이 기본으로 서빙하는 표준 spotlight 슬롯 prefix + 한국어 alt.
 * 이 슬롯들을 데모 테넌트에 시드해 두면, 앱이 pk_demo 로 가리켰을 때 바로 콘텐츠가 뜬다.
 * (기존 라이브 DB 는 migrations 의 0001_seed_sibling_spotlights 가 동일하게 채운다.)
 */
const SPOTLIGHT = [
  { prefix: 'home', alt: '스폰서 추천' },
  { prefix: 'partners', alt: '추천 제작사' },
  { prefix: 'discover', alt: '추천 모임' },
  { prefix: 'species', alt: '추천 반려동물' },
  { prefix: 'market', alt: '추천 프로젝트' },
] as const
const SPOTLIGHT_NS = [1, 2, 3]

/** 데모 슬롯 — 지면 정의(사이드바·피드 + 형제앱 spotlight 15). */
const DEMO_SLOTS: { key: string; label: string; sizes: string[] }[] = [
  { key: 'sidebar', label: '사이드바', sizes: ['300x250'] },
  { key: 'feed', label: '피드 인라인', sizes: ['728x90', '320x50'] },
  ...SPOTLIGHT.flatMap(({ prefix }) =>
    SPOTLIGHT_NS.map((n) => ({
      key: `${prefix}-spotlight-${n}`,
      label: `${prefix} spotlight ${n}`,
      sizes: ['1200x675'],
    }))
  ),
]

/** 데모 크리에이티브 — 가중치/슬롯/노출·클릭이 채워져 서빙·통계가 비지 않도록. */
interface DemoCreative {
  slotKey: string
  imageUrl: string
  linkUrl: string
  alt: string
  weight: number
  impressions: number
  clicks: number
}

const DEMO_CREATIVES: DemoCreative[] = [
  {
    slotKey: 'sidebar',
    imageUrl: 'https://picsum.photos/seed/addesk-a/300/250',
    linkUrl: 'https://example.com/summer',
    alt: '여름 세일 — 최대 50% 할인',
    weight: 3,
    impressions: 1280,
    clicks: 47,
  },
  {
    slotKey: 'sidebar',
    imageUrl: 'https://picsum.photos/seed/addesk-b/300/250',
    linkUrl: 'https://example.com/newsletter',
    alt: '뉴스레터 구독하고 쿠폰 받기',
    weight: 1,
    impressions: 410,
    clicks: 9,
  },
  {
    slotKey: 'feed',
    imageUrl: 'https://picsum.photos/seed/addesk-c/728/90',
    linkUrl: 'https://example.com/app',
    alt: '앱 다운로드 — 지금 무료',
    weight: 2,
    impressions: 980,
    clicks: 61,
  },
  // 형제앱 spotlight 슬롯별 크리에이티브 1개씩(가중치 1, 16:9 picsum).
  ...SPOTLIGHT.flatMap(({ prefix, alt }) =>
    SPOTLIGHT_NS.map((n): DemoCreative => {
      const slotKey = `${prefix}-spotlight-${n}`
      return {
        slotKey,
        imageUrl: `https://picsum.photos/seed/ad-${slotKey}/1200/675`,
        linkUrl: `https://example.com/${slotKey}`,
        alt,
        weight: 1,
        impressions: 0,
        clicks: 0,
      }
    })
  ),
]

export interface SeedResult {
  seeded: boolean
}

/**
 * 멱등 시드 — 테넌트가 하나도 없을 때만 데모 테넌트 + 슬롯·캠페인·크리에이티브를 채운다.
 * (자료가 이미 있으면 건너뜀.)
 */
export async function runSeed(
  dbs: DatabaseService,
  opts: { demo: boolean; pepper: string }
): Promise<SeedResult> {
  if (!opts.demo) return { seeded: false }

  const existing = await dbs.db.select({ c: sql<number>`count(*)` }).from(tenants)
  if (Number(existing[0]?.c ?? 0) > 0) return { seeded: false }

  const tenantRows = await dbs.db
    .insert(tenants)
    .values({
      name: DEMO.name,
      slug: DEMO.slug,
      plan: 'free',
      publishableKey: DEMO.publishableKey,
      secretKeyHash: hashSecretKey(DEMO.secretKey, opts.pepper),
      corsOrigins: [...DEMO.corsOrigins],
      usageCount: 0,
    })
    .returning({ id: tenants.id })
  const tenantId = tenantRows[0]!.id

  // 슬롯.
  for (const s of DEMO_SLOTS) {
    await dbs.db.insert(slots).values({ tenantId, key: s.key, label: s.label, sizes: [...s.sizes] })
  }

  // 캠페인(활성, 즉시 시작·무기한).
  const campaignRows = await dbs.db
    .insert(campaigns)
    .values({
      tenantId,
      name: '데모 캠페인',
      status: 'active',
      startsAt: daysAgo(7),
      endsAt: null,
    })
    .returning({ id: campaigns.id })
  const campaignId = campaignRows[0]!.id

  // 크리에이티브.
  let serveCount = 0
  for (const c of DEMO_CREATIVES) {
    await dbs.db.insert(creatives).values({
      tenantId,
      campaignId,
      slotKey: c.slotKey,
      imageUrl: c.imageUrl,
      linkUrl: c.linkUrl,
      alt: c.alt,
      weight: c.weight,
      impressions: c.impressions,
      clicks: c.clicks,
    })
    serveCount += c.impressions
  }

  // 누적 서빙 카운터를 시드 노출 합으로 반영(소프트 캡 데모).
  await dbs.db
    .update(tenants)
    .set({ usageCount: serveCount })
    .where(sql`${tenants.id} = ${tenantId}`)

  return { seeded: true }
}
