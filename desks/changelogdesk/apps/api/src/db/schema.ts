import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import type { EntryTag, Plan } from '@changelogdesk/shared'

/**
 * 테넌트(조직) — 외부 서비스가 셀프서브 가입. 퍼블리시 키는 평문(브라우저 노출 안전),
 * 시크릿 키는 해시만 저장. corsOrigins 는 퍼블리시 키 엔드포인트의 Origin 화이트리스트.
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    /** pk_… — 평문 저장·조회(브라우저 위젯이 사용). 유니크 인덱스로 빠른 조회. */
    publishableKey: text('publishable_key').notNull(),
    /** sk_… 의 SHA-256 hex 해시 — 평문은 저장하지 않는다. */
    secretKeyHash: text('secret_key_hash').notNull(),
    /** Origin 화이트리스트(text[]). '*' 면 모두 허용. */
    corsOrigins: text('cors_origins').array().notNull().$type<string[]>().default([]),
    plan: text('plan').notNull().$type<Plan>().default('free'),
    /** 공개 위젯 호출 누적 카운터(소프트 한도 판정용). */
    usageCount: integer('usage_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('tenants_slug_uq').on(t.slug),
    unique('tenants_pk_uq').on(t.publishableKey),
    index('idx_tenants_pk').on(t.publishableKey),
  ]
)

/**
 * 체인지로그 항목 — 테넌트별 'What's new'. 게시(isPublished)된 항목만 위젯에 노출.
 * publishedAt 은 게시 시점(목록 정렬·증분 since 기준).
 */
export const changelogEntries = pgTable(
  'changelog_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    bodyMarkdown: text('body_markdown').notNull().default(''),
    tag: text('tag').notNull().$type<EntryTag>(),
    version: text('version'),
    category: text('category'),
    isPublished: boolean('is_published').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_entries_tenant_published').on(t.tenantId, t.isPublished, t.publishedAt),
    index('idx_entries_tenant_created').on(t.tenantId, t.createdAt),
  ]
)

/**
 * 미읽음 배지용 마지막 본 항목 — (tenantId, anonId) 당 1행. upsert.
 * anonId 는 위젯이 디바이스에 저장하는 익명 식별자.
 */
export const readReceipts = pgTable(
  'read_receipts',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    anonId: text('anon_id').notNull(),
    lastSeenEntryId: uuid('last_seen_entry_id'),
    seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('read_receipts_tenant_anon_uq').on(t.tenantId, t.anonId)]
)
