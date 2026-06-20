import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import type { Plan, ReviewMeta, ReviewStatus } from '@reviewdesk/shared'

/**
 * 테넌트 — 외부 고객(서비스). 가입 시 publishable/secret 키를 발급받는다.
 * secretKeyHash 에는 SHA-256 해시만 저장(평문은 가입 응답에서 1회만 노출).
 * publishableKey·slug 는 유니크. corsOrigins 는 공개 엔드포인트 Origin 허용목록.
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    publishableKey: text('publishable_key').notNull(),
    secretKeyHash: text('secret_key_hash').notNull(),
    /** 허용 오리진 목록(jsonb). `*` 포함 시 전체 허용. */
    corsOrigins: jsonb('cors_origins').$type<string[]>().notNull().default([]),
    plan: text('plan').$type<Plan>().notNull().default('free'),
    /** true 면 제출 즉시 approved(검수 생략). */
    autoApprove: boolean('auto_approve').notNull().default(false),
    /** 누적 제출 수(무료 플랜 소프트 한도 검사용). */
    usageCount: integer('usage_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('tenants_publishable_key_uq').on(t.publishableKey),
    unique('tenants_slug_uq').on(t.slug),
  ]
)

/**
 * 리뷰 — 테넌트의 subject(product/page/entity)에 대한 평점·후기.
 * status 로 검수 상태 추적(pending|approved|rejected), featured 면 후기 월에 노출.
 * authorEmail 은 비공개(어드민만). reply 는 운영자 답글.
 */
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    subjectId: text('subject_id').notNull(),
    subjectLabel: text('subject_label'),
    rating: integer('rating').notNull(),
    title: text('title'),
    body: text('body').notNull(),
    authorName: text('author_name').notNull(),
    /** 비공개 — 어드민에게만 노출. */
    authorEmail: text('author_email'),
    status: text('status').$type<ReviewStatus>().notNull().default('pending'),
    featured: boolean('featured').notNull().default(false),
    /** 운영자 답글(있으면). */
    reply: text('reply'),
    source: text('source'),
    meta: jsonb('meta').$type<ReviewMeta>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_reviews_tenant_subject_status').on(t.tenantId, t.subjectId, t.status),
    index('idx_reviews_tenant_status_created').on(t.tenantId, t.status, t.createdAt),
    index('idx_reviews_tenant_featured').on(t.tenantId, t.featured),
  ]
)
