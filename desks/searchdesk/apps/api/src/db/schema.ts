import {
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

import type { Plan } from '@searchdesk/shared'

/**
 * 테넌트 — 외부 온보딩(셀프 가입)의 단위. publishable 키(브라우저, 검색)·secret 키(서버, 색인, 해시 저장).
 * corsOrigins 는 publishable(검색) 호출을 허용할 출처 목록. docCount 는 누적 문서 카운터(소프트 캡).
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    plan: text('plan').$type<Plan>().notNull().default('free'),
    /** pk_… — 브라우저 노출 가능. 검색 호출에 사용. */
    publishableKey: text('publishable_key').notNull(),
    /** sk_… 의 scrypt 해시(평문 미저장). */
    secretKeyHash: text('secret_key_hash').notNull(),
    /** sk_… 의 결정적 SHA-256 룩업 해시(WHERE 조회용). */
    secretKeyLookup: text('secret_key_lookup').notNull(),
    /** publishable(검색) 호출 허용 출처('*' 또는 origin 목록). */
    corsOrigins: jsonb('cors_origins').$type<string[]>().notNull().default([]),
    /** 누적 색인 문서 카운터(소프트 캡 판정). */
    docCount: integer('doc_count').notNull().default(0),
    /** 누적 검색 호출 카운터(사용량). */
    searchCount: integer('search_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('tenants_slug_uq').on(t.slug),
    unique('tenants_publishable_uq').on(t.publishableKey),
    index('idx_tenants_secret_lookup').on(t.secretKeyLookup),
  ]
)

/**
 * 문서 — 테넌트별·인덱스별 색인 단위. `(tenantId, indexName, docId)` 유니크(upsert 키).
 * title/body 가 전문 검색 대상. searchText 는 'title body' 결합(소문자 폴백 검색용).
 * Postgres 경로에서는 search_text 에 tsvector GIN 인덱스를 따로 건다(0001 마이그레이션, pg 전용).
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    indexName: text('index_name').notNull(),
    /** 테넌트가 지정하는 안정적 식별자(upsert 키). */
    docId: text('doc_id').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    url: text('url'),
    category: text('category'),
    /** 패싯/필터용 태그 목록. */
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    /** 임의 구조화 메타데이터(검색 비대상). */
    attrs: jsonb('attrs').$type<Record<string, unknown>>(),
    /** 'title body' 결합 — 소문자 LIKE 폴백 + Postgres tsvector 소스. */
    searchText: text('search_text').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('documents_tenant_index_doc_uq').on(t.tenantId, t.indexName, t.docId),
    index('idx_documents_tenant_index').on(t.tenantId, t.indexName),
    index('idx_documents_category').on(t.tenantId, t.indexName, t.category),
  ]
)

/**
 * 방문 추적 — 일별 버킷(day PK). 신규 추적이라 비어서 시작해 실제 핑으로 누적된다.
 * totalVisits = 누적 페이지뷰, uniqueVisitors = 그 날 최초 방문 쿠키 수('오늘 고유'의 정직한 정의).
 * 양쪽 드라이버(Postgres·PGlite)에 동일 적용(0002 마이그레이션).
 */
export const visits = pgTable('visits', {
  /** 버킷 날짜(서버 TZ 기준 'YYYY-MM-DD'). */
  day: date('day').primaryKey(),
  /** 누적 페이지뷰(방문마다 +1). */
  totalVisits: integer('total_visits').notNull().default(0),
  /** 그 날 최초 방문(신규 쿠키) 수. */
  uniqueVisitors: integer('unique_visitors').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
