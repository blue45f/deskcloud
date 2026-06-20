import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import type {
  MatchedRule,
  Plan,
  ReportStatus,
  RuleAction,
  RuleKind,
  Verdict,
} from '@moderationdesk/shared'

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
    /** 누적 검사 수(무료 플랜 소프트 한도 검사용). */
    usageCount: integer('usage_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('tenants_publishable_key_uq').on(t.publishableKey),
    unique('tenants_slug_uq').on(t.slug),
  ]
)

/**
 * 금칙 규칙 — 테넌트별 모더레이션 규칙. pattern 을 kind(exact|substring|regex)로 매칭하고
 * action(block|flag|review)으로 verdict 를 유발한다. enabled=false 면 평가에서 제외.
 */
export const forbiddenRules = pgTable(
  'forbidden_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    pattern: text('pattern').notNull(),
    kind: text('kind').$type<RuleKind>().notNull().default('substring'),
    action: text('action').$type<RuleAction>().notNull().default('block'),
    /** 운영자용 라벨(선택). */
    label: text('label'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_rules_tenant_enabled').on(t.tenantId, t.enabled)]
)

/**
 * 신고 — 공개 키로 접수된 콘텐츠 신고. 어드민이 status 로 전이한다.
 * subjectType/subjectId 는 신고 대상(예: comment/c_123). reporterId 는 선택(귀속 신고).
 */
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    reason: text('reason').notNull(),
    reporterId: text('reporter_id'),
    status: text('status').$type<ReportStatus>().notNull().default('open'),
    /** 운영자 메모(선택). */
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_reports_tenant_status_created').on(t.tenantId, t.status, t.createdAt),
    index('idx_reports_tenant_subject').on(t.tenantId, t.subjectType, t.subjectId),
  ]
)

/**
 * 모더레이션 로그 — append-only. 모든 검사 결과를 적재해 어드민이 조회한다.
 * matchedRules 는 매칭된 규칙 요약(jsonb), aiScore 는 AI 보조 점수(있을 때만).
 */
export const moderationLogs = pgTable(
  'moderation_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    text: text('text').notNull(),
    verdict: text('verdict').$type<Verdict>().notNull(),
    matchedRules: jsonb('matched_rules').$type<MatchedRule[]>().notNull().default([]),
    aiScore: real('ai_score'),
    source: text('source'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_logs_tenant_created').on(t.tenantId, t.createdAt),
    index('idx_logs_tenant_verdict').on(t.tenantId, t.verdict),
  ]
)
