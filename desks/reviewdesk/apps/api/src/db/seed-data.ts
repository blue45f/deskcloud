import { sql } from 'drizzle-orm'

import { hashSecretKey } from '../common/keys'

import { DatabaseService } from './database.service'
import { reviews, tenants } from './schema'

import type { ReviewMeta, ReviewStatus } from '@reviewdesk/shared'

const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

/** 데모 테넌트 — 가입 없이 위젯·어드민을 바로 체험할 수 있게 고정 키를 사용한다. */
const DEMO_PUBLISHABLE_KEY = 'pk_demo'
const DEMO_SECRET_KEY = 'sk_demo'

interface SeedReview {
  subjectId: string
  subjectLabel: string
  rating: number
  title?: string
  body: string
  authorName: string
  authorEmail?: string
  status: ReviewStatus
  featured?: boolean
  reply?: string
  source?: string
  daysAgo: number
}

/** 두 개 subject(pro-plan·landing)에 걸친 ~15개 리뷰(별점·상태·추천 혼합). */
const DEMO_REVIEWS: SeedReview[] = [
  // ── pro-plan ──────────────────────────────────────────────────────────────
  {
    subjectId: 'pro-plan',
    subjectLabel: 'Pro 플랜',
    rating: 5,
    title: '기대 이상이에요',
    body: '도입 후 운영 시간이 절반으로 줄었습니다. 강력 추천합니다.',
    authorName: '김서연',
    authorEmail: 'seoyeon@example.com',
    status: 'approved',
    featured: true,
    reply: '소중한 후기 감사합니다! 앞으로도 잘 부탁드려요.',
    source: 'web',
    daysAgo: 2,
  },
  {
    subjectId: 'pro-plan',
    subjectLabel: 'Pro 플랜',
    rating: 5,
    title: '팀 전체가 만족',
    body: '협업 기능이 특히 좋네요. 온보딩도 매끄러웠습니다.',
    authorName: '이준호',
    status: 'approved',
    featured: true,
    source: 'web',
    daysAgo: 4,
  },
  {
    subjectId: 'pro-plan',
    subjectLabel: 'Pro 플랜',
    rating: 4,
    body: '전반적으로 좋지만 가격이 조금 부담됩니다.',
    authorName: '박민지',
    status: 'approved',
    source: 'widget',
    daysAgo: 6,
  },
  {
    subjectId: 'pro-plan',
    subjectLabel: 'Pro 플랜',
    rating: 4,
    title: '안정적',
    body: '몇 달째 쓰는데 다운된 적이 없어요.',
    authorName: '정우성',
    status: 'approved',
    daysAgo: 9,
  },
  {
    subjectId: 'pro-plan',
    subjectLabel: 'Pro 플랜',
    rating: 3,
    body: '기능은 좋은데 모바일 앱이 아쉬워요.',
    authorName: '한지민',
    status: 'approved',
    daysAgo: 11,
  },
  {
    subjectId: 'pro-plan',
    subjectLabel: 'Pro 플랜',
    rating: 5,
    body: '고객지원이 빠르고 친절합니다.',
    authorName: '최유진',
    authorEmail: 'yujin@example.com',
    status: 'pending',
    daysAgo: 1,
  },
  {
    subjectId: 'pro-plan',
    subjectLabel: 'Pro 플랜',
    rating: 2,
    title: '연동이 까다로움',
    body: '초기 설정에서 헤맸습니다. 문서가 더 친절했으면.',
    authorName: '오세훈',
    status: 'pending',
    daysAgo: 1,
  },
  {
    subjectId: 'pro-plan',
    subjectLabel: 'Pro 플랜',
    rating: 1,
    body: '스팸성 광고 내용입니다 방문하세요 example.spam',
    authorName: 'spammer',
    status: 'rejected',
    daysAgo: 3,
  },
  // ── landing ─────────────────────────────────────────────────────────────────
  {
    subjectId: 'landing',
    subjectLabel: '랜딩 페이지',
    rating: 5,
    title: '한눈에 들어와요',
    body: '제품 설명이 명확해서 바로 가입했습니다.',
    authorName: '강다은',
    status: 'approved',
    featured: true,
    daysAgo: 5,
  },
  {
    subjectId: 'landing',
    subjectLabel: '랜딩 페이지',
    rating: 4,
    body: '디자인이 깔끔하네요.',
    authorName: '윤재호',
    status: 'approved',
    daysAgo: 7,
  },
  {
    subjectId: 'landing',
    subjectLabel: '랜딩 페이지',
    rating: 4,
    body: '가격 정보를 더 위에 두면 좋겠어요.',
    authorName: '서지우',
    status: 'approved',
    daysAgo: 8,
  },
  {
    subjectId: 'landing',
    subjectLabel: '랜딩 페이지',
    rating: 5,
    title: '신뢰가 가요',
    body: '후기가 많아서 믿고 시작했습니다.',
    authorName: '임채원',
    status: 'approved',
    daysAgo: 12,
  },
  {
    subjectId: 'landing',
    subjectLabel: '랜딩 페이지',
    rating: 3,
    body: '로딩이 조금 느린 것 같아요.',
    authorName: '문가영',
    status: 'approved',
    daysAgo: 14,
  },
  {
    subjectId: 'landing',
    subjectLabel: '랜딩 페이지',
    rating: 5,
    body: '데모 영상이 인상적이었어요.',
    authorName: '신동욱',
    status: 'pending',
    daysAgo: 1,
  },
  {
    subjectId: 'landing',
    subjectLabel: '랜딩 페이지',
    rating: 2,
    body: '문의 폼이 잘 안 보여요.',
    authorName: '배수지',
    status: 'pending',
    daysAgo: 2,
  },
]

export interface SeedResult {
  seeded: boolean
}

/**
 * 멱등 시드 — 테넌트가 하나도 없을 때만 데모 테넌트 + 샘플 리뷰를 채운다.
 * (자료가 이미 있으면 건너뜀.)
 */
export async function runSeed(dbs: DatabaseService, opts: { demo: boolean }): Promise<SeedResult> {
  if (!opts.demo) return { seeded: false }

  const existing = await dbs.db.select({ c: sql<number>`count(*)` }).from(tenants)
  if (Number(existing[0]?.c ?? 0) > 0) return { seeded: false }

  const insertedTenant = await dbs.db
    .insert(tenants)
    .values({
      name: 'Demo Co.',
      slug: 'demo',
      publishableKey: DEMO_PUBLISHABLE_KEY,
      secretKeyHash: hashSecretKey(DEMO_SECRET_KEY),
      corsOrigins: ['*'],
      plan: 'pro',
      autoApprove: false,
      usageCount: DEMO_REVIEWS.length,
    })
    .returning()
  const tenant = insertedTenant[0]!

  const rows: (typeof reviews.$inferInsert)[] = DEMO_REVIEWS.map((r) => {
    const meta: ReviewMeta = {
      pageUrl: `https://demo.example/${r.subjectId}`,
      userAgent: 'Mozilla/5.0 (demo seed)',
    }
    return {
      tenantId: tenant.id,
      subjectId: r.subjectId,
      subjectLabel: r.subjectLabel,
      rating: r.rating,
      title: r.title ?? null,
      body: r.body,
      authorName: r.authorName,
      authorEmail: r.authorEmail ?? null,
      status: r.status,
      featured: r.featured ?? false,
      reply: r.reply ?? null,
      source: r.source ?? 'seed',
      meta,
      createdAt: daysAgo(r.daysAgo),
    }
  })
  await dbs.db.insert(reviews).values(rows)

  return { seeded: true }
}
