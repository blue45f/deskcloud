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

import type {
  BoardKind,
  ContentStatus,
  Plan,
  ReactionKind,
  ReactionTarget,
} from '@communitydesk/shared'

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
    /** 누적 글 작성 수(무료 플랜 소프트 한도 검사용). */
    postsCount: integer('posts_count').notNull().default(0),
    /** 누적 글 읽기 수. */
    readsCount: integer('reads_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('tenants_publishable_key_uq').on(t.publishableKey),
    unique('tenants_slug_uq').on(t.slug),
  ]
)

/** 게시판·카페 — 테넌트당 여러 개. (tenantId, slug) 유니크. */
export const boards = pgTable(
  'boards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    kind: text('kind').$type<BoardKind>().notNull().default('board'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('boards_tenant_slug_uq').on(t.tenantId, t.slug),
    index('idx_boards_tenant').on(t.tenantId),
  ]
)

/**
 * 글(스레드) — 보드의 글. body 는 마크다운 원문, bodyHtml 은 서버 살균 HTML.
 * status 로 노출/숨김/검수, pinned/locked 로 운영. reactions 는 kind 별 카운트 캐시.
 */
export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    boardId: uuid('board_id').notNull(),
    authorMemberId: text('author_member_id').notNull(),
    authorName: text('author_name').notNull(),
    title: text('title'),
    body: text('body').notNull(),
    bodyHtml: text('body_html').notNull(),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    pinned: boolean('pinned').notNull().default(false),
    locked: boolean('locked').notNull().default(false),
    status: text('status').$type<ContentStatus>().notNull().default('visible'),
    /** kind 별 반응 카운트 캐시(reactions 테이블에서 파생, 토글 시 갱신). */
    reactions: jsonb('reactions')
      .$type<Partial<Record<ReactionKind, number>>>()
      .notNull()
      .default({}),
    replyCount: integer('reply_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_posts_tenant_board_status').on(t.tenantId, t.boardId, t.status),
    index('idx_posts_tenant_status_created').on(t.tenantId, t.status, t.createdAt),
    index('idx_posts_board_pinned').on(t.boardId, t.pinned),
  ]
)

/** 댓글 — 글에 대한 (중첩) 댓글. parentId 로 트리 구성. */
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    postId: uuid('post_id').notNull(),
    parentId: uuid('parent_id'),
    authorMemberId: text('author_member_id').notNull(),
    authorName: text('author_name').notNull(),
    body: text('body').notNull(),
    bodyHtml: text('body_html').notNull(),
    status: text('status').$type<ContentStatus>().notNull().default('visible'),
    reactions: jsonb('reactions')
      .$type<Partial<Record<ReactionKind, number>>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_comments_tenant_post').on(t.tenantId, t.postId),
    index('idx_comments_parent').on(t.parentId),
  ]
)

/**
 * 반응 — 멤버가 글/댓글에 남긴 반응. 같은 (테넌트,타깃,멤버,kind) 는 1건(토글).
 * 토글 시 이 테이블을 갱신하고, post/comment.reactions 카운트 캐시를 재계산한다.
 */
export const reactions = pgTable(
  'reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    targetType: text('target_type').$type<ReactionTarget>().notNull(),
    targetId: uuid('target_id').notNull(),
    memberId: text('member_id').notNull(),
    kind: text('kind').$type<ReactionKind>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('reactions_unique').on(t.tenantId, t.targetType, t.targetId, t.memberId, t.kind),
    index('idx_reactions_target').on(t.tenantId, t.targetType, t.targetId),
  ]
)

/**
 * 일별 방문 집계 — 트래픽/방문자 대시보드용. (tenantId, day) 당 1행.
 * visits 는 페이지/글 조회 누적, uniqueVisitors 는 그날 처음 본 멤버 수.
 * 이 릴리스부터 누적되며 이전 날짜는 데이터가 없어 0(백필하지 않음).
 */
export const dailyVisits = pgTable(
  'daily_visits',
  {
    tenantId: uuid('tenant_id').notNull(),
    day: date('day').notNull(),
    visits: integer('visits').notNull().default(0),
    uniqueVisitors: integer('unique_visitors').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.day] }),
    index('idx_daily_visits_tenant_day').on(t.tenantId, t.day),
  ]
)

/**
 * 고유 방문자 중복 제거용 — (tenantId, day, memberId) 당 1행. 새로 삽입될 때만
 * daily_visits.uniqueVisitors 를 증가시킨다(ON CONFLICT DO NOTHING).
 */
export const dailyVisitorSeen = pgTable(
  'daily_visitor_seen',
  {
    tenantId: uuid('tenant_id').notNull(),
    day: date('day').notNull(),
    memberId: text('member_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.day, t.memberId] })]
)
