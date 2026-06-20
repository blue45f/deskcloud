import {
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

import type { CampaignStatus, Plan } from '@addesk/shared'

/**
 * 테넌트 — 외부 온보딩(셀프 가입)의 단위. publishable 키(브라우저)·secret 키(서버, 해시 저장).
 * corsOrigins 는 publishable 호출을 허용할 출처 목록. usageCount 는 누적 광고 서빙 카운터(소프트 캡).
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    plan: text('plan').$type<Plan>().notNull().default('free'),
    /** pk_… — 브라우저 노출 가능. 서빙·노출/클릭 추적에 사용. */
    publishableKey: text('publishable_key').notNull(),
    /** sk_… 의 결정적 SHA-256(peppered) 해시. WHERE 조회 + 인증에 사용(평문 미저장). */
    secretKeyHash: text('secret_key_hash').notNull(),
    /** publishable 호출 허용 출처('*' 또는 origin 목록). */
    corsOrigins: jsonb('cors_origins').$type<string[]>().notNull().default([]),
    /** 누적 광고 서빙 카운터(무료 플랜 소프트 캡 판정). */
    usageCount: integer('usage_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('tenants_slug_uq').on(t.slug),
    unique('tenants_publishable_uq').on(t.publishableKey),
    index('idx_tenants_secret_hash').on(t.secretKeyHash),
  ]
)

/**
 * 캠페인 — 크리에이티브의 묶음. status(active|paused) + 기간(startsAt/endsAt)으로 서빙 여부가 결정된다.
 * `(tenantId)` 범위에서 관리된다.
 */
export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    name: text('name').notNull(),
    status: text('status').$type<CampaignStatus>().notNull().default('active'),
    /** 서빙 시작 시각(없으면 즉시). */
    startsAt: timestamp('starts_at', { withTimezone: true }),
    /** 서빙 종료 시각(없으면 무기한). */
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_campaigns_tenant').on(t.tenantId, t.status)]
)

/**
 * 크리에이티브 — 실제 배너(이미지 + 링크). slotKey(지면)에 매핑되고, weight 로 가중 랜덤 선택된다.
 * impressions/clicks 는 누적 카운터(서빙 추적). 캠페인이 paused/기간외면 서빙 대상에서 제외.
 */
export const creatives = pgTable(
  'creatives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    campaignId: uuid('campaign_id').notNull(),
    /** 노출될 지면(슬롯 key). */
    slotKey: text('slot_key').notNull(),
    imageUrl: text('image_url').notNull(),
    linkUrl: text('link_url').notNull(),
    alt: text('alt').notNull(),
    /** 가중 랜덤 선택의 상대 비중(정수 ≥ 1). */
    weight: integer('weight').notNull().default(1),
    /** 누적 노출 수. */
    impressions: integer('impressions').notNull().default(0),
    /** 누적 클릭 수. */
    clicks: integer('clicks').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_creatives_tenant_slot').on(t.tenantId, t.slotKey),
    index('idx_creatives_campaign').on(t.campaignId),
  ]
)

/**
 * 슬롯 — 지면 정의(key + 라벨 + 허용 배너 사이즈). 서빙 응답의 권장 size 힌트를 제공한다.
 * `(tenantId, key)` 유니크.
 */
export const slots = pgTable(
  'slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    key: text('key').notNull(),
    label: text('label'),
    sizes: jsonb('sizes').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('slots_tenant_key_uq').on(t.tenantId, t.key)]
)

/**
 * 업로드 이미지 — 어드민이 외부 URL 대신 직접 올린 광고 이미지. 별도 오브젝트 스토리지 없이
 * base64 텍스트로 보관해 서버리스(Neon)·PGlite 양쪽에서 동일하게 동작한다. 공개 GET 으로 서빙되며
 * 그 절대 URL 을 크리에이티브 imageUrl 로 쓴다(불투명 UUID 라 추측 불가).
 */
export const adUploads = pgTable(
  'ad_uploads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    contentType: text('content_type').notNull(),
    /** base64 인코딩된 이미지 바이트(data: 프리픽스 제외). */
    data: text('data').notNull(),
    /** 디코딩된 바이트 수(소프트 캡/표시용). */
    bytes: integer('bytes').notNull(),
    filename: text('filename'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_ad_uploads_tenant').on(t.tenantId)]
)

/**
 * 일일 방문(서빙) 버킷 — 서빙 성공 1건이 테넌트 지면의 실제 방문/트래픽 신호다. AdsService.serve()
 * 가 served:true 일 때 (tenantId, day) 로 UPSERT 한다(visits +1). 대시보드 "오늘 방문자" 가 여기서
 * 읽는다. **배포 이후 집계**(백필 없음) — UI 는 0 부터 정직하게 누적한다(가짜 히스토리 금지).
 * `(tenantId, day)` 복합 PK 로 멱등 UPSERT(PostgreSQL·PGlite 동일).
 */
export const adVisits = pgTable(
  'ad_visits',
  {
    tenantId: uuid('tenant_id').notNull(),
    /** 서버 일자(UTC) 버킷. */
    day: date('day').notNull(),
    /** 그날 서빙된(방문) 누적 수. */
    visits: integer('visits').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.day] }),
    index('idx_ad_visits_tenant').on(t.tenantId),
  ]
)
