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

import type { Channel, NotificationStatus, Plan } from '@notifydesk/shared'

/**
 * 테넌트 — 외부 온보딩(셀프 가입)의 단위. publishable 키(브라우저)·secret 키(서버, 해시 저장).
 * corsOrigins 는 publishable 호출을 허용할 출처 목록. usageCount 는 누적 발송 카운터(소프트 캡).
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    plan: text('plan').$type<Plan>().notNull().default('free'),
    /** pk_… — 브라우저 노출 가능. 인박스 조회/읽음에 사용. */
    publishableKey: text('publishable_key').notNull(),
    /** sk_… 의 scrypt 해시(평문 미저장). */
    secretKeyHash: text('secret_key_hash').notNull(),
    /** sk_… 의 결정적 SHA-256 룩업 해시(WHERE 조회용). */
    secretKeyLookup: text('secret_key_lookup').notNull(),
    /** publishable 호출 허용 출처('*' 또는 origin 목록). */
    corsOrigins: jsonb('cors_origins').$type<string[]>().notNull().default([]),
    /** 누적 발송 카운터(소프트 캡 판정). */
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
 * 알림 템플릿 — 테넌트별 알림 종류. `(tenantId, key)` 유니크.
 * bodyTemplate 은 mustache-ish `{{var}}` 치환. subject 는 email/web-push 제목(선택).
 */
export const notificationTemplates = pgTable(
  'notification_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    key: text('key').notNull(),
    channels: jsonb('channels').$type<Channel[]>().notNull(),
    subject: text('subject'),
    bodyTemplate: text('body_template').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('templates_tenant_key_uq').on(t.tenantId, t.key),
    index('idx_templates_tenant').on(t.tenantId),
  ]
)

/**
 * 알림 — 발송된 알림의 영구 기록(in-app 인박스의 행). status 로 queued→sent→read 추적.
 * data 는 템플릿 렌더 변수 + 클라이언트에 전달할 구조화 페이로드.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    recipientId: text('recipient_id').notNull(),
    type: text('type').notNull(),
    channels: jsonb('channels').$type<Channel[]>().notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>(),
    status: text('status').$type<NotificationStatus>().notNull().default('sent'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_notifications_inbox').on(t.tenantId, t.recipientId, t.createdAt),
    index('idx_notifications_tenant_created').on(t.tenantId, t.createdAt),
  ]
)

/**
 * 선호 설정 — (tenantId, recipientId, type, channel) 별 on/off. opt-out 모델(없으면 허용).
 * in_app 은 항상 저장되므로 선호로 끌 수 없다(게이팅 로직이 무시).
 */
export const preferences = pgTable(
  'preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    recipientId: text('recipient_id').notNull(),
    type: text('type').notNull(),
    channel: text('channel').$type<Channel>().notNull(),
    enabled: boolean('enabled').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('preferences_uq').on(t.tenantId, t.recipientId, t.type, t.channel),
    index('idx_preferences_lookup').on(t.tenantId, t.recipientId),
  ]
)
