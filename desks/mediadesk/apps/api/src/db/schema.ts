import {
  bigint,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import type { Plan } from '@mediadesk/shared'

/**
 * 테넌트 — self-register 로 생성. publishable 키(pk_)는 평문 저장(브라우저 노출 가능),
 * secret 키(sk_)는 sha-256 해시만 저장(평문은 가입/회전 응답에서만 1회 노출).
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    plan: text('plan').$type<Plan>().notNull().default('free'),
    publishableKey: text('publishable_key').notNull(),
    secretKeyHash: text('secret_key_hash').notNull(),
    corsOrigins: jsonb('cors_origins').$type<string[]>().notNull().default([]),
    storageDriver: text('storage_driver').notNull().default('local'),
    usageBytes: bigint('usage_bytes', { mode: 'number' }).notNull().default(0),
    usageCount: integer('usage_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('tenants_slug_uq').on(t.slug), unique('tenants_pk_uq').on(t.publishableKey)]
)

/**
 * 자산 — 테넌트별 업로드된 파일 메타. 실제 바이트는 StorageAdapter(파일시스템/S3)에 저장.
 * key 는 테넌트 내부 상대 경로(저장·공개 URL 세그먼트). (tenantId, key) 유니크.
 */
export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    key: text('key').notNull(),
    folder: text('folder'),
    contentType: text('content_type').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    width: integer('width'),
    height: integer('height'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('assets_tenant_key_uq').on(t.tenantId, t.key),
    index('idx_assets_tenant_created').on(t.tenantId, t.createdAt),
    index('idx_assets_tenant_folder').on(t.tenantId, t.folder),
  ]
)

/**
 * 방문 집계 — 일별 버킷(day 가 PK). visitors=고유 방문자(advisory), hits=총 방문.
 * 운영 트래픽 지표의 단일 소스. 롤아웃 시점부터 누적되며 소급 백필은 하지 않는다(정직성).
 */
export const visits = pgTable('visits', {
  day: date('day').primaryKey(),
  visitors: integer('visitors').notNull().default(0),
  hits: integer('hits').notNull().default(0),
})
