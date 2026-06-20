import {
  boolean,
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

import type { Attachment, ConversationKind, Plan } from '@chatdesk/shared'

/**
 * 테넌트 — 외부 가입 단위. publishable 키(pk_)는 평문(브라우저 노출), secret 키(sk_)는
 * sha-256 해시로만 저장한다. corsOrigins 는 WS 핸드셰이크·pk 엔드포인트의 Origin allowlist.
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** `pk_…` 평문. WS 핸드셰이크·pk REST 의 공개 식별자. 유니크. */
    publishableKey: text('publishable_key').notNull(),
    /** `sk_…` 의 sha-256 해시(hex). 평문은 발급 응답에서만 1회 노출. */
    secretKeyHash: text('secret_key_hash').notNull(),
    /** 허용 Origin 목록(jsonb). `['*']` 는 모두 허용(데모). */
    corsOrigins: jsonb('cors_origins').$type<string[]>().notNull(),
    plan: text('plan').$type<Plan>().notNull().default('free'),
    usageMessages: integer('usage_messages').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('tenants_publishable_key_uq').on(t.publishableKey),
    unique('tenants_secret_key_hash_uq').on(t.secretKeyHash),
  ]
)

/**
 * 대화 — 1:1 쪽지(dm) 또는 그룹/룸(group). memberIds 는 호스트 앱의 사용자 id 배열(jsonb).
 * DM 은 정렬된 멤버쌍에서 파생한 dmKey 로 `(tenantId, dmKey)` 유니크 → 같은 쌍 대화 dedupe.
 * group 은 dmKey 가 null.
 */
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    kind: text('kind').$type<ConversationKind>().notNull(),
    title: text('title'),
    memberIds: jsonb('member_ids').$type<string[]>().notNull(),
    /** DM dedupe 키(정렬된 멤버쌍). group 은 null. */
    dmKey: text('dm_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('conversations_tenant_dmkey_uq').on(t.tenantId, t.dmKey),
    index('idx_conversations_tenant_created').on(t.tenantId, t.createdAt),
  ]
)

/**
 * 메시지 — append-only. 보낸 멤버(senderMemberId; 시스템 메시지는 null)·본문·첨부.
 * 모더레이션은 hard delete 가 아니라 soft delete(deletedAt) — 히스토리 무결성 유지.
 */
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    /** 보낸 멤버. 시스템 메시지는 null. */
    senderMemberId: text('sender_member_id'),
    body: text('body').notNull(),
    attachments: jsonb('attachments').$type<Attachment[]>(),
    system: boolean('system').notNull().default(false),
    /** 모더레이션 삭제 시각(soft delete). null 이면 살아 있음. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_messages_conv_created').on(t.conversationId, t.createdAt),
    index('idx_messages_tenant_created').on(t.tenantId, t.createdAt),
  ]
)

/**
 * 읽음 리시트 — 대화×멤버 당 한 행. lastReadMessageId 이후의 메시지가 unread.
 * PK `(conversationId, memberId)`.
 */
export const receipts = pgTable(
  'receipts',
  {
    conversationId: uuid('conversation_id').notNull(),
    memberId: text('member_id').notNull(),
    lastReadMessageId: uuid('last_read_message_id'),
    /** 리시트 갱신 시 기준 메시지 시각(unread 카운트의 created_at 비교 기준). */
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.memberId] })]
)

/**
 * 방문 일별 버킷 — 테넌트×일자 한 행. pageviews 는 ping 마다 +1(총 트래픽),
 * visitors 는 그날 고유 방문자 수(tenant_visit_uniques 와 동기). 기존 카운터가 없어
 * 신규로 추적하며, 위젯/SDK 의 공개 ping 이 채운다. 임베드 전에는 행이 없어 0(정직한 0).
 */
export const tenantVisits = pgTable(
  'tenant_visits',
  {
    tenantId: uuid('tenant_id').notNull(),
    /** 집계 일자(서버 TZ 기준 date). */
    day: date('day').notNull(),
    visitors: integer('visitors').notNull().default(0),
    pageviews: integer('pageviews').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.day] }),
    index('idx_tenant_visits_tenant_day').on(t.tenantId, t.day),
  ]
)

/**
 * 고유 방문자 원장 — (tenant, day, visitorId) PK 로 같은 방문자를 하루 1회만 센다.
 * 공개 ping 은 ON CONFLICT DO NOTHING 으로 삽입하고, 삽입이 일어난 경우에만
 * tenant_visits.visitors 를 +1 한다 → 진짜 고유 카운트.
 */
export const tenantVisitUniques = pgTable(
  'tenant_visit_uniques',
  {
    tenantId: uuid('tenant_id').notNull(),
    day: date('day').notNull(),
    visitorId: text('visitor_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.day, t.visitorId] })]
)
