import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import type { InquiryCategory, InquiryStatus, MemberRole, Plan, UsageMetric } from '@desk/shared'

/**
 * 테넌트(조직) — 멀티테넌트 루트. publishable 키는 평문(공개 안전), secret 은 해시만 저장.
 * slug·publishableKey·secretKeyHash 는 유니크(조회 키).
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
 * 멤버(좌석) — 유료 티어 팀 좌석. (tenantId, email) 유니크.
 */
export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    email: text('email').notNull(),
    role: text('role').$type<MemberRole>().notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('members_tenant_email_uq').on(t.tenantId, t.email),
    index('idx_members_tenant').on(t.tenantId),
  ]
)

/**
 * 사용량 카운터 — (tenantId, period, metric) 단위 누적값. period 는 'YYYY-MM'.
 * UsageMeter 가 increment/get/reset 한다.
 */
export const usageCounters = pgTable(
  'usage_counters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    period: text('period').notNull(),
    metric: text('metric').$type<UsageMetric>().notNull(),
    /** 누적값 — 큰 수 대비 bigint(JS number 로 매핑). */
    count: bigint('count', { mode: 'number' }).notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('usage_tenant_period_metric_uq').on(t.tenantId, t.period, t.metric),
    index('idx_usage_tenant_period').on(t.tenantId, t.period),
  ]
)

/**
 * 구독 — 테넌트별 1개(tenantId 유니크). 결제 어댑터·상태 머신이 갱신한다.
 * status 는 @desk/billing 의 SubscriptionStatusValue, provider 는 BillingProvider.
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    plan: text('plan').$type<Plan>().notNull().default('free'),
    status: text('status').notNull().default('none'),
    provider: text('provider').notNull().default('stub'),
    providerSubscriptionId: text('provider_subscription_id'),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('subscriptions_tenant_uq').on(t.tenantId)]
)

/**
 * 문의(Inquiry) — 형제 앱이 공개 API 로 제출하는 게시판 항목. 테넌트가 아니라
 * `appId`(형제 앱 식별자)로 묶인다(공개 위젯이라 키 인증 없이 들어온다).
 * (appId)·(appId, createdAt)·(appId, status, createdAt) 인덱스로 앱별 최신순/상태별
 * 어드민 큐 조회를 가속한다.
 */
export const inquiries = pgTable(
  'inquiries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appId: text('app_id').notNull(),
    category: text('category').$type<InquiryCategory>().notNull(),
    status: text('status').$type<InquiryStatus>().notNull().default('new'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    contactEmail: text('contact_email'),
    originUrl: text('origin_url'),
    authorName: text('author_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_inquiries_app').on(t.appId),
    index('idx_inquiries_app_created').on(t.appId, t.createdAt),
    index('idx_inquiries_app_status_created').on(t.appId, t.status, t.createdAt),
  ]
)

/**
 * 일별 방문 집계(daily_visits) — 형제 앱이 공개 핑 API 로 누적하는 트래픽 버킷.
 * 테넌트가 아니라 `appId`(형제 앱 식별자) + `day`('YYYY-MM-DD', UTC)로 묶인다.
 * visits=총 방문(pageview), uniques=고유 방문자(브라우저 최초 방문). (appId, day) 유니크.
 */
export const dailyVisits = pgTable(
  'daily_visits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appId: text('app_id').notNull(),
    day: text('day').notNull(),
    /** 누적값 — 큰 수 대비 bigint(JS number 로 매핑). */
    visits: bigint('visits', { mode: 'number' }).notNull().default(0),
    uniques: bigint('uniques', { mode: 'number' }).notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('daily_visits_app_day_uq').on(t.appId, t.day),
    index('idx_daily_visits_app').on(t.appId),
  ]
)
