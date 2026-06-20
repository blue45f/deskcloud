import {
  bigserial,
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

import type { Plan } from '@realtimedesk/shared'

/**
 * 테넌트 — 외부 가입 단위. publishable 키(pk_)는 평문(브라우저 노출), secret 키(sk_)는
 * sha-256 해시로만 저장한다. corsOrigins 는 WS 핸드셰이크·pk 엔드포인트의 Origin allowlist.
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** `pk_…` 평문. WS 핸드셰이크·history 의 공개 식별자. 유니크. */
    publishableKey: text('publishable_key').notNull(),
    /** `sk_…` 의 sha-256 해시(hex). 평문은 발급 응답에서만 1회 노출. */
    secretKeyHash: text('secret_key_hash').notNull(),
    /** 허용 Origin 목록(jsonb). `['*']` 는 모두 허용(데모). */
    corsOrigins: jsonb('cors_origins').$type<string[]>().notNull(),
    plan: text('plan').$type<Plan>().notNull().default('free'),
    usageMessages: integer('usage_messages').notNull().default(0),
    usageConnections: integer('usage_connections').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('tenants_publishable_key_uq').on(t.publishableKey),
    unique('tenants_secret_key_hash_uq').on(t.secretKeyHash),
  ]
)

/**
 * 메시지 — append-only. publish 시 채널로 브로드캐스트하고 (history 활성 시) 영속화.
 * 채널당 최근 N건만 의미가 있으나(서비스에서 N으로 자름) 저장 자체는 append.
 */
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** 단조 증가 시퀀스 — 같은 published_at 안에서도 삽입 순서를 보장하는 정렬 타이브레이커. */
    seq: bigserial('seq', { mode: 'number' }).notNull(),
    tenantId: uuid('tenant_id').notNull(),
    channel: text('channel').notNull(),
    event: text('event').notNull(),
    data: jsonb('data'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_messages_tenant_channel_seq').on(t.tenantId, t.channel, t.seq),
    index('idx_messages_tenant_seq').on(t.tenantId, t.seq),
  ]
)

/**
 * 방문 추적 — 일자(KST 자정 기준) 버킷. 사이트 트래픽(방문자·조회수)을 가볍게 집계한다.
 * `day` 는 서버가 Asia/Seoul 자정 기준으로 키잉(타임존 정직성). 개인정보는 저장하지 않는다.
 * 운영 대시보드의 트래픽 지표는 이 테이블에서 SUM/오늘 버킷으로 계산된다(tracked-new).
 */
export const visits = pgTable('visits', {
  /** 일자(YYYY-MM-DD, KST 자정 기준). 버킷 키. */
  day: date('day').primaryKey(),
  /** 그날의 고유 방문자 수(세션 첫 방문 기준). */
  visitors: integer('visitors').notNull().default(0),
  /** 그날의 총 조회(hit) 수. */
  hits: integer('hits').notNull().default(0),
})
