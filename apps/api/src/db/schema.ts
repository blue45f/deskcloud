import {
  bigint,
  boolean,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import type { Plan, UsageMetric } from '@authdesk/shared'

/**
 * 테넌트(앱) — 멀티테넌트 루트. publishable 키는 평문(공개 안전), secret 은 해시만 저장.
 * slug·publishableKey·secretKeyHash 는 유니크(조회 키).
 *
 * 주: 테넌트 키(pk_/sk_)는 **앱 식별**용이다. 테넌트 풀의 end-user(end_users)와 혼동하지 말 것.
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    publishableKey: text('publishable_key').notNull(),
    secretKeyHash: text('secret_key_hash').notNull(),
    /** CORS allowlist origin 배열(jsonb). */
    corsOrigins: jsonb('cors_origins').$type<string[]>().notNull().default([]),
    plan: text('plan').$type<Plan>().notNull().default('free'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('tenants_slug_uq').on(t.slug),
    unique('tenants_pk_uq').on(t.publishableKey),
    unique('tenants_skhash_uq').on(t.secretKeyHash),
  ]
)

/**
 * end-user — 테넌트 풀의 최종 사용자. email 은 (tenantId, email) 유니크.
 * passwordHash 는 scrypt(node:crypto). verified 는 이메일 인증 여부(코어는 미인증 가입 허용).
 */
export const endUsers = pgTable(
  'end_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    verified: boolean('verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** 마지막 로그인 시각(통계용). */
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => [
    unique('end_users_tenant_email_uq').on(t.tenantId, t.email),
    index('idx_end_users_tenant_created').on(t.tenantId, t.createdAt),
  ]
)

/**
 * 세션 — 발급한 end-user JWT 의 추적 레코드(jti = id). 로그아웃 시 revoked 로 폐기.
 * JWT 자체는 무상태지만, 명시적 로그아웃/강제 폐기를 위해 서버에 jti 를 남긴다(블랙리스트).
 */
export const sessions = pgTable(
  'sessions',
  {
    /** JWT 의 jti(고유 세션 식별자). */
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_sessions_user').on(t.userId), index('idx_sessions_tenant').on(t.tenantId)]
)

/**
 * 사용량 카운터 — (tenantId, metric) 단위 누적값. UsageService 가 increment/get 한다.
 * auth_users 는 실시간 count 로 계산하므로, 여기엔 주로 logins(누적) 가 들어간다.
 */
export const usageCounters = pgTable(
  'usage_counters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    metric: text('metric').$type<UsageMetric>().notNull(),
    count: bigint('count', { mode: 'number' }).notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('usage_tenant_metric_uq').on(t.tenantId, t.metric)]
)

/**
 * 트래픽 일별 버킷 — (tenantId, day) 단위 방문 집계. 위젯/대시보드가 공개 핑(POST /auth/visit)을
 * 쏘면 visits +1, 첫 방문(unique vid)이면 uniques +1 한다.
 *
 * 가입(end_users.createdAt)과 달리 페이지 방문 추적은 신규 기능이라 과거를 채울 수 없다 —
 * 카운트는 배포 시점부터 쌓이며, 운영자에게 '추적 시작 이후'로 정직하게 표기한다.
 */
export const trafficDaily = pgTable(
  'traffic_daily',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    /** 날짜 버킷(서버 tz 기준 자정 경계, YYYY-MM-DD). */
    day: date('day').notNull(),
    visits: bigint('visits', { mode: 'number' }).notNull().default(0),
    uniques: bigint('uniques', { mode: 'number' }).notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('traffic_daily_tenant_day_uq').on(t.tenantId, t.day),
    index('idx_traffic_daily_tenant_day').on(t.tenantId, t.day),
  ]
)

/**
 * 방문자 일별 seen-set — (tenantId, day, vidHash) 유니크. ON CONFLICT DO NOTHING 으로
 * "그날 처음 본 방문자"를 정직하게 셈한다(삽입된 행 수 = 신규 unique). vid 원문은 저장하지 않고
 * SHA-256(pk + day + vid|ip) 해시만 둔다(프라이버시).
 */
export const visitorSeen = pgTable(
  'visitor_seen',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    day: date('day').notNull(),
    /** SHA-256 해시(pk + day + vid|ip). 원문 vid/ip 는 저장하지 않는다. */
    vidHash: text('vid_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('visitor_seen_uq').on(t.tenantId, t.day, t.vidHash)]
)
