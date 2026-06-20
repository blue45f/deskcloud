import { hashPassword, hashSecretKey } from '@authdesk/shared'
import { sql } from 'drizzle-orm'

import { DatabaseService } from './database.service'
import { endUsers, tenants, trafficDaily, usageCounters } from './schema'

const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

/** n일 전 날짜 버킷(YYYY-MM-DD, 서버 tz) — traffic_daily.day 시드용. */
const dayKeyAgo = (n: number): string => {
  const d = daysAgo(n)
  d.setHours(0, 0, 0, 0)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * 데모 테넌트 — 고정 키(pk_demo/sk_demo)로 로컬 검증/문서가 바로 동작하도록.
 * corsOrigins ['*'] 는 isOriginAllowed 가 정확매칭만 허용하므로 실제로는 Origin 헤더 없는
 * 요청(서버-서버·동일 출처)만 통과한다 — 데모 편의를 위한 느슨한 값(운영은 명시 origin 권장).
 */
const DEMO = {
  name: 'Demo Co',
  slug: 'demo',
  publishableKey: 'pk_demo',
  secretKey: 'sk_demo',
  corsOrigins: ['http://localhost:5310', 'http://localhost:4110'],
} as const

/** 데모 end-user 들 — 비밀번호는 모두 'Password123!'(데모 안내용, 평문은 시드에만). */
const DEMO_PASSWORD = 'Password123!'

interface DemoUser {
  email: string
  name: string
  verified: boolean
  ageDays: number
  loggedInDaysAgo: number | null
}

const DEMO_USERS: DemoUser[] = [
  { email: 'ada@demo.test', name: 'Ada Lovelace', verified: true, ageDays: 28, loggedInDaysAgo: 1 },
  { email: 'alan@demo.test', name: 'Alan Turing', verified: true, ageDays: 12, loggedInDaysAgo: 2 },
  {
    email: 'grace@demo.test',
    name: 'Grace Hopper',
    verified: false,
    ageDays: 5,
    loggedInDaysAgo: null,
  },
  {
    email: 'linus@demo.test',
    name: 'Linus Torvalds',
    verified: true,
    ageDays: 2,
    loggedInDaysAgo: 1,
  },
]

export interface SeedResult {
  seeded: boolean
}

/**
 * 멱등 시드 — 테넌트가 하나도 없을 때만 데모 테넌트 + 샘플 end-user 를 채운다.
 * (자료가 이미 있으면 건너뜀.) 비밀번호는 scrypt 로 해시해 저장한다(평문 미보관).
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
    })
    .returning({ id: tenants.id })
  const tenantId = tenantRows[0]!.id

  // 비밀번호 해시는 병렬로 — scrypt 는 의도적으로 느리다.
  const passwordHash = await hashPassword(DEMO_PASSWORD)
  for (const u of DEMO_USERS) {
    await dbs.db.insert(endUsers).values({
      tenantId,
      email: u.email,
      passwordHash,
      name: u.name,
      verified: u.verified,
      createdAt: daysAgo(u.ageDays),
      lastLoginAt: u.loggedInDaysAgo == null ? null : daysAgo(u.loggedInDaysAgo),
    })
  }

  // 사용량 카운터 시드: 누적 logins(데모용 임의값)만. auth_users 는 end_users 라이브 count 로
  // 파생하므로(드리프트 방지) 카운터로 두지 않는다.
  await dbs.db.insert(usageCounters).values([{ tenantId, metric: 'logins', count: 17 }])

  // 트래픽 일별 버킷 시드(데모용) — 대시보드 패널이 빈 0 만 보이지 않게 며칠치 방문을 채운다.
  // 운영에선 위젯/대시보드 핑이 배포 시점부터 실제로 쌓인다('추적 시작 이후').
  await dbs.db.insert(trafficDaily).values([
    { tenantId, day: dayKeyAgo(6), visits: 41, uniques: 27 },
    { tenantId, day: dayKeyAgo(5), visits: 53, uniques: 33 },
    { tenantId, day: dayKeyAgo(4), visits: 38, uniques: 24 },
    { tenantId, day: dayKeyAgo(3), visits: 62, uniques: 39 },
    { tenantId, day: dayKeyAgo(2), visits: 49, uniques: 31 },
    { tenantId, day: dayKeyAgo(1), visits: 57, uniques: 36 },
    { tenantId, day: dayKeyAgo(0), visits: 24, uniques: 18 },
  ])

  return { seeded: true }
}
