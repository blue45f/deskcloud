import {
  boolean,
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

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  // 조직(프로젝트) 로고 URL — 공개 약관/지원 페이지 헤더 아이콘(없으면 모노그램 폴백).
  logoUrl: text('logo_url'),
  // B2B 플랜('free'|'pro'|'team') — 시트/리소스/월 호출 한도의 기준. 청구는 mock(결정 기록만).
  plan: text('plan').notNull().default('free'),
  planChangedAt: timestamp('plan_changed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    name: text('name').notNull(),
    // 소셜 로그인 사용자는 비밀번호가 없으므로 nullable.
    passwordHash: text('password_hash'),
    provider: text('provider').notNull().default('password'),
    googleSub: text('google_sub'),
    role: text('role').notNull().default('viewer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('users_org_email_uq').on(t.orgId, t.email)]
)

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  scopes: text('scopes').notNull().default('read:current,write:consent'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
})

export const policies = pgTable(
  'policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull().default('custom'),
    jurisdiction: text('jurisdiction').notNull().default('KR'),
    description: text('description'),
    // 공개/비공개('public'|'private') — 무인증 공개 렌더 노출 제어. 게시·해시와 무관.
    visibility: text('visibility').notNull().default('public'),
    currentVersionId: uuid('current_version_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [unique('policies_org_slug_uq').on(t.orgId, t.slug)]
)

export const policyVersions = pgTable(
  'policy_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => policies.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    versionLabel: text('version_label').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    contentHash: text('content_hash'),
    status: text('status').notNull().default('draft'),
    locale: text('locale').notNull().default('ko'),
    requiresReconsent: boolean('requires_reconsent').notNull().default(false),
    changeSummary: text('change_summary'),
    effectiveAt: timestamp('effective_at', { withTimezone: true }),
    createdBy: uuid('created_by'),
    publishedBy: uuid('published_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [unique('versions_policy_number_uq').on(t.policyId, t.versionNumber)]
)

export const consentReceipts = pgTable(
  'consent_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => policies.id, { onDelete: 'cascade' }),
    policyVersionId: uuid('policy_version_id')
      .notNull()
      .references(() => policyVersions.id),
    contentHash: text('content_hash').notNull(),
    subjectRef: text('subject_ref').notNull(),
    decision: text('decision').notNull().default('accepted'),
    method: text('method').notNull().default('checkbox_clickwrap'),
    locale: text('locale').notNull().default('ko'),
    evidence: jsonb('evidence'),
    parentReceiptId: uuid('parent_receipt_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_receipts_subject').on(t.orgId, t.subjectRef),
    index('idx_receipts_version').on(t.policyVersionId),
  ]
)

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id'),
    actorName: text('actor_name'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id'),
    metadata: jsonb('metadata'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_audit_org').on(t.orgId, t.createdAt)]
)

export const supportPosts = pgTable(
  'support_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectSlug: text('project_slug').notNull(),
    category: text('category').notNull(),
    status: text('status').notNull().default('open'),
    authorName: text('author_name').notNull(),
    contact: text('contact').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_support_posts_project').on(t.projectSlug, t.category, t.createdAt),
    index('idx_support_posts_status').on(t.status, t.createdAt),
  ]
)

/**
 * 월별 API 사용 카운터 — API 키 가드가 호출마다 UPSERT 증가(org × yyyymm).
 * PK(org_id, yyyymm)가 UPSERT 충돌 대상이자 조회 인덱스. yyyymm 은 UTC 'YYYYMM'.
 */
export const apiUsage = pgTable(
  'api_usage',
  {
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    yyyymm: text('yyyymm').notNull(),
    count: integer('count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: 'api_usage_pk', columns: [t.orgId, t.yyyymm] })]
)

// ── 약관 의뢰 중계(Brokerage) ──────────────────────────────────────────────────
// 의뢰자(조직)와 전문가(사용자)를 잇는 마켓플레이스. 의뢰는 조직에 귀속되고, 제안·전문가
// 프로필은 사용자에 귀속된다(크로스-조직). 금액은 메타데이터일 뿐 자금 이동은 없다.

export const serviceRequests = pgTable(
  'service_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // 의뢰자 조직 — 의뢰는 조직에 귀속(조직 삭제 시 의뢰도 삭제).
    requesterOrgId: uuid('requester_org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // 담당자(사용자) — FK 없이 스냅샷 보관(사용자 삭제와 분리). 이름도 스냅샷.
    requesterUserId: uuid('requester_user_id'),
    requesterName: text('requester_name').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    serviceType: text('service_type').notNull().default('draft'),
    policyType: text('policy_type').notNull().default('custom'),
    jurisdiction: text('jurisdiction').notNull().default('KR'),
    budgetMin: integer('budget_min'),
    budgetMax: integer('budget_max'),
    deadline: timestamp('deadline', { withTimezone: true }),
    status: text('status').notNull().default('open'),
    visibility: text('visibility').notNull().default('public'),
    acceptedProposalId: uuid('accepted_proposal_id'),
    assignedProviderUserId: uuid('assigned_provider_user_id'),
    assignedProviderOrgId: uuid('assigned_provider_org_id'),
    assignedProviderName: text('assigned_provider_name'),
    // 모의 에스크로 — 자금 이동 없이 상태/금액만 기록(표시 전용).
    escrowStatus: text('escrow_status').notNull().default('none'),
    escrowAmount: integer('escrow_amount'),
    // 분쟁 큐 — 참여자 신고·이의제기 또는 운영자 판단으로 표시.
    flagged: boolean('flagged').notNull().default(false),
    disputeNote: text('dispute_note'),
    adminNote: text('admin_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_requests_status').on(t.status, t.createdAt),
    index('idx_requests_org').on(t.requesterOrgId, t.createdAt),
    index('idx_requests_provider').on(t.assignedProviderUserId, t.status),
    index('idx_requests_market').on(t.visibility, t.status, t.createdAt),
    index('idx_requests_flagged').on(t.flagged, t.updatedAt),
  ]
)

export const requestProposals = pgTable(
  'request_proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => serviceRequests.id, { onDelete: 'cascade' }),
    providerUserId: uuid('provider_user_id').notNull(),
    providerOrgId: uuid('provider_org_id'),
    providerName: text('provider_name').notNull(),
    message: text('message').notNull(),
    quotedAmount: integer('quoted_amount'),
    estimatedDays: integer('estimated_days'),
    status: text('status').notNull().default('submitted'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // 전문가는 의뢰당 하나의 제안만(철회 후 재제안 시 같은 행 갱신).
    unique('proposals_request_provider_uq').on(t.requestId, t.providerUserId),
    index('idx_proposals_request').on(t.requestId, t.status),
    index('idx_proposals_provider').on(t.providerUserId, t.createdAt),
  ]
)

export const requestMessages = pgTable(
  'request_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => serviceRequests.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id'),
    authorName: text('author_name').notNull(),
    authorRole: text('author_role').notNull().default('requester'),
    kind: text('kind').notNull().default('message'),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_request_messages').on(t.requestId, t.createdAt)]
)

export const requestAttachments = pgTable(
  'request_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => serviceRequests.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').references(() => requestMessages.id, { onDelete: 'cascade' }),
    uploaderUserId: uuid('uploader_user_id'),
    uploaderName: text('uploader_name').notNull(),
    uploaderRole: text('uploader_role').notNull().default('requester'),
    fileName: text('file_name').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storageKey: text('storage_key').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_request_attachments_request').on(t.requestId, t.createdAt),
    index('idx_request_attachments_message').on(t.messageId, t.createdAt),
    index('idx_request_attachments_uploader').on(t.uploaderUserId, t.createdAt),
  ]
)

export const providerProfiles = pgTable(
  'provider_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // 사용자 1인당 프로필 1개(opt-in). 조직은 표시용.
    userId: uuid('user_id').notNull().unique(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    headline: text('headline').notNull(),
    bio: text('bio').notNull(),
    // 전문 분야 태그 — CSV 보관, DTO 에서 string[] 로 노출.
    specialties: text('specialties').notNull().default(''),
    jurisdictions: text('jurisdictions').notNull().default('KR'),
    hourlyRate: integer('hourly_rate'),
    contact: text('contact'),
    // 운영자 검증 배지(신뢰 신호). 자동 부여 아님.
    verified: boolean('verified').notNull().default(false),
    active: boolean('active').notNull().default(true),
    // 완료 누적(완료 시 증가) — 마켓 정렬·신뢰 신호.
    completedCount: integer('completed_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_providers_active').on(t.active, t.verified, t.completedCount),
    index('idx_providers_org').on(t.orgId),
  ]
)

export const providerReviews = pgTable(
  'provider_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // 평가 대상 전문가(사용자) — FK 없는 스냅샷(사용자 삭제와 분리).
    providerUserId: uuid('provider_user_id').notNull(),
    // 평가 근거가 된 완료 의뢰 — 의뢰당 1건(unique). 의뢰 삭제 시 후기도 삭제.
    requestId: uuid('request_id')
      .notNull()
      .references(() => serviceRequests.id, { onDelete: 'cascade' }),
    reviewerOrgId: uuid('reviewer_org_id'),
    reviewerUserId: uuid('reviewer_user_id'),
    reviewerName: text('reviewer_name').notNull(),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('reviews_request_uq').on(t.requestId),
    index('idx_reviews_provider').on(t.providerUserId, t.createdAt),
  ]
)

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // 수신자(사용자) — FK 없는 스냅샷. orgId 는 스코프·삭제 정합용.
    userId: uuid('user_id').notNull(),
    orgId: uuid('org_id').notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    // 연결 대상 의뢰(있으면). 의뢰 삭제 시 알림도 정리.
    requestId: uuid('request_id').references(() => serviceRequests.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_notifications_user').on(t.userId, t.createdAt),
    index('idx_notifications_unread').on(t.userId, t.readAt),
  ]
)

export const inquiries = pgTable(
  'inquiries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // 출처 사이트 식별(1차 축) — 정적 포트폴리오 사이트는 DB 조직 없이 slug 로만 존재.
    siteSlug: text('site_slug').notNull(),
    // DB 조직 매치 시에만 연결(정적 카탈로그 사이트는 NULL, 조직 삭제 시 연결만 해제).
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
    category: text('category').notNull().default('contact'),
    status: text('status').notNull().default('new'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    contactEmail: text('contact_email'),
    originUrl: text('origin_url'),
    userAgent: text('user_agent'),
    ip: text('ip'),
    adminNote: text('admin_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_inquiries_site_status').on(t.siteSlug, t.status, t.createdAt),
    index('idx_inquiries_site_category').on(t.siteSlug, t.category, t.createdAt),
    index('idx_inquiries_site_ip_recent').on(t.siteSlug, t.ip, t.createdAt),
  ]
)
