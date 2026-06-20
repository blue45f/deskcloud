import { hashSecretKey, type EntryTag } from '@changelogdesk/shared'
import { eq, sql } from 'drizzle-orm'

import { DatabaseService } from './database.service'
import { changelogEntries, tenants } from './schema'

const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

/** 데모 테넌트 — 고정 키(로컬 위젯/어드민이 바로 붙도록). corsOrigins '*' 로 모두 허용. */
export const DEMO_TENANT = {
  name: 'Demo Workspace',
  slug: 'demo',
  publishableKey: 'pk_demo',
  secretKey: 'sk_demo',
  corsOrigins: ['*'] as string[],
} as const

interface DemoEntry {
  title: string
  tag: EntryTag
  version?: string
  category?: string
  bodyMarkdown: string
  publishedDaysAgo: number
}

/** ~8개 샘플 항목 — 태그를 골고루 섞어 위젯/어드민이 비어 보이지 않게. */
const DEMO_ENTRIES: DemoEntry[] = [
  {
    title: '다크 모드 출시',
    tag: 'new',
    version: '2.4.0',
    category: 'UI',
    bodyMarkdown:
      '드디어 **다크 모드**가 도착했습니다. 설정 → 테마에서 켤 수 있어요.\n\n- 시스템 설정 자동 감지\n- 페이지 전환 깜빡임 없음',
    publishedDaysAgo: 1,
  },
  {
    title: '대시보드 로딩 속도 40% 개선',
    tag: 'improved',
    version: '2.3.2',
    category: 'Performance',
    bodyMarkdown: '초기 쿼리를 묶어 처리해 대시보드 첫 화면이 훨씬 빨라졌습니다.',
    publishedDaysAgo: 3,
  },
  {
    title: 'CSV 내보내기 인코딩 버그 수정',
    tag: 'fixed',
    version: '2.3.1',
    bodyMarkdown: '한글이 깨지던 문제를 수정했습니다(UTF-8 BOM 추가).',
    publishedDaysAgo: 5,
  },
  {
    title: '6월 정기 점검 안내',
    tag: 'announcement',
    category: 'Notice',
    bodyMarkdown:
      '6월 20일 02:00–03:00(KST) 점검이 예정되어 있습니다. 자세한 내용은 [상태 페이지](https://status.example.com)를 확인하세요.',
    publishedDaysAgo: 6,
  },
  {
    title: 'Slack 알림 연동',
    tag: 'new',
    version: '2.3.0',
    category: 'Integrations',
    bodyMarkdown: '워크스페이스를 Slack 채널에 연결해 실시간 알림을 받아보세요.',
    publishedDaysAgo: 9,
  },
  {
    title: '키보드 단축키 추가',
    tag: 'improved',
    version: '2.2.5',
    bodyMarkdown: '`?` 키로 단축키 목록을 열 수 있습니다.',
    publishedDaysAgo: 12,
  },
  {
    title: '간헐적 로그아웃 문제 해결',
    tag: 'fixed',
    version: '2.2.4',
    bodyMarkdown: '세션 토큰 갱신 경합으로 가끔 로그아웃되던 문제를 수정했습니다.',
    publishedDaysAgo: 16,
  },
  {
    title: '새 요금제 페이지 공개',
    tag: 'announcement',
    category: 'Billing',
    bodyMarkdown: '더 투명해진 요금제를 확인해보세요. 기존 고객 영향은 없습니다.',
    publishedDaysAgo: 20,
  },
]

export interface SeedResult {
  seeded: boolean
}

/**
 * 멱등 시드 — 테넌트가 하나도 없을 때만 데모 테넌트 + 샘플 항목을 채운다.
 * (자료가 이미 있으면 건너뜀.)
 */
export async function runSeed(dbs: DatabaseService, opts: { demo: boolean }): Promise<SeedResult> {
  if (!opts.demo) return { seeded: false }

  const existing = await dbs.db.select({ c: sql<number>`count(*)` }).from(tenants)
  if (Number(existing[0]?.c ?? 0) > 0) return { seeded: false }

  const inserted = await dbs.db
    .insert(tenants)
    .values({
      name: DEMO_TENANT.name,
      slug: DEMO_TENANT.slug,
      publishableKey: DEMO_TENANT.publishableKey,
      secretKeyHash: hashSecretKey(DEMO_TENANT.secretKey),
      corsOrigins: DEMO_TENANT.corsOrigins,
      plan: 'pro',
    })
    .returning()
  const tenant = inserted[0]!

  const rows = DEMO_ENTRIES.map((e) => ({
    tenantId: tenant.id,
    title: e.title,
    bodyMarkdown: e.bodyMarkdown,
    tag: e.tag,
    version: e.version ?? null,
    category: e.category ?? null,
    isPublished: true,
    publishedAt: daysAgo(e.publishedDaysAgo),
    createdAt: daysAgo(e.publishedDaysAgo),
  }))
  await dbs.db.insert(changelogEntries).values(rows)

  return { seeded: true }
}

/** 테넌트 존재 여부(테스트·헬스 용). */
export async function hasTenant(dbs: DatabaseService, slug: string): Promise<boolean> {
  const r = await dbs.db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1)
  return r.length > 0
}
