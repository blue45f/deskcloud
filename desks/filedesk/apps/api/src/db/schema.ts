import {
  bigint,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import type { Plan, Visibility } from '@filedesk/shared'

/** Postgres `bytea` ↔ Node Buffer 커스텀 타입(node-postgres·PGlite 양쪽 Buffer 로 매핑). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea'
  },
})

/**
 * 테넌트 — 외부 온보딩(셀프 가입)의 단위. publishable 키(브라우저)·secret 키(서버, 해시 저장).
 * corsOrigins 는 publishable 호출을 허용할 출처 목록. usageCount 는 누적 업로드 카운터(소프트 캡).
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    plan: text('plan').$type<Plan>().notNull().default('free'),
    /** pk_… — 브라우저 노출 가능. 업로드(공개 경로)에 사용. */
    publishableKey: text('publishable_key').notNull(),
    /** sk_… 의 scrypt 해시(평문 미저장). */
    secretKeyHash: text('secret_key_hash').notNull(),
    /** sk_… 의 결정적 SHA-256 룩업 해시(WHERE 조회용). */
    secretKeyLookup: text('secret_key_lookup').notNull(),
    /** publishable 호출 허용 출처('*' 또는 origin 목록). */
    corsOrigins: jsonb('cors_origins').$type<string[]>().notNull().default([]),
    /** 누적 업로드 카운터(소프트 캡 판정). */
    usageCount: integer('usage_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('tenants_slug_uq').on(t.slug),
    unique('tenants_publishable_uq').on(t.publishableKey),
    index('idx_tenants_secret_lookup').on(t.secretKeyLookup),
  ]
)

/**
 * 파일 객체 — 업로드된 파일의 레지스트리 행(바이트는 별도 file_blobs / 외부 스토리지).
 * key 는 테넌트 범위에서 불투명 식별자(서빙 URL 경로). `(tenantId, key)` 유니크.
 */
export const fileObjects = pgTable(
  'file_objects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    key: text('key').notNull(),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    /** 바이트 크기 — bigint(JS number 매핑, 큰 파일 대비). */
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    visibility: text('visibility').$type<Visibility>().notNull().default('public'),
    /** 이 파일을 저장한 드라이버('postgres' | 's3') — 서빙·삭제 라우팅. */
    storageDriver: text('storage_driver').notNull().default('postgres'),
    /** 드라이버별 참조 — postgres 는 미사용(file_blobs.fileId), s3 는 object key. */
    storageRef: text('storage_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('file_objects_tenant_key_uq').on(t.tenantId, t.key),
    index('idx_file_objects_tenant_created').on(t.tenantId, t.createdAt),
    index('idx_file_objects_tenant_visibility').on(t.tenantId, t.visibility),
  ]
)

/**
 * 파일 바이트 — Postgres-bytea 어댑터의 실제 내용(작은 파일 인라인 저장). `fileId` 유니크.
 * S3/R2 어댑터는 이 테이블을 쓰지 않는다(객체 스토리지에 저장, storageRef 로 참조).
 */
export const fileBlobs = pgTable(
  'file_blobs',
  {
    fileId: uuid('file_id').primaryKey(),
    bytes: bytea('bytes').notNull(),
  },
  () => []
)

/**
 * 일자별 방문 집계 — 운영 현황 패널의 '오늘 방문자 수'·'총 트래픽' 원천(저렴한 일 단위 합계).
 * visitors 는 고유 브라우저/일(아래 siteVisitors 로 중복 제거), pageviews 는 누적 핑 수.
 * 테넌트 범위가 없는 플랫폼 전역 카운터(공개 집계, PII 미저장).
 */
export const siteVisitDays = pgTable(
  'site_visit_days',
  {
    day: date('day').primaryKey(),
    visitors: integer('visitors').notNull().default(0),
    pageviews: integer('pageviews').notNull().default(0),
  },
  () => []
)

/**
 * 일자별 고유 방문자 중복 제거 키 — (day, visitorHash) 유니크.
 * visitorHash = SHA-256(pepper + clientId). clientId 는 브라우저가 localStorage 에 보관하는
 * 무작위 식별자. IP/PII 는 저장하지 않는다(정직한 '고유 브라우저/일' 집계).
 */
export const siteVisitors = pgTable(
  'site_visitors',
  {
    day: date('day').notNull(),
    visitorHash: text('visitor_hash').notNull(),
  },
  (t) => [primaryKey({ columns: [t.day, t.visitorHash] })]
)
