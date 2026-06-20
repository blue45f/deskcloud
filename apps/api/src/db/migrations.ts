export interface Migration {
  name: string
  sql: string
}

/**
 * 부팅 마이그레이션. PostgreSQL · PGlite(둘 다 Postgres 16 의미론) 양쪽에 동일하게 적용됩니다.
 * 파일시스템에서 읽지 않고 문자열 상수로 박아 컴파일/런타임 어디서나 동일하게 동작합니다.
 * 스키마 변경 시 새 Migration 을 배열 끝에 append (멱등하게: IF NOT EXISTS 등).
 */
export const MIGRATIONS: Migration[] = [
  {
    name: '0000_init',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_org_email_uq UNIQUE (org_id, email)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text NOT NULL DEFAULT 'read:current,write:consent',
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'custom',
  jurisdiction text NOT NULL DEFAULT 'KR',
  description text,
  current_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT policies_org_slug_uq UNIQUE (org_id, slug)
);

CREATE TABLE IF NOT EXISTS policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  version_label text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  content_hash text,
  status text NOT NULL DEFAULT 'draft',
  locale text NOT NULL DEFAULT 'ko',
  requires_reconsent boolean NOT NULL DEFAULT false,
  change_summary text,
  effective_at timestamptz,
  created_by uuid,
  published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  archived_at timestamptz,
  CONSTRAINT versions_policy_number_uq UNIQUE (policy_id, version_number)
);

CREATE TABLE IF NOT EXISTS consent_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  policy_version_id uuid NOT NULL REFERENCES policy_versions(id),
  content_hash text NOT NULL,
  subject_ref text NOT NULL,
  decision text NOT NULL DEFAULT 'accepted',
  method text NOT NULL DEFAULT 'checkbox_clickwrap',
  locale text NOT NULL DEFAULT 'ko',
  evidence jsonb,
  parent_receipt_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_receipts_subject ON consent_receipts (org_id, subject_ref);
CREATE INDEX IF NOT EXISTS idx_receipts_version ON consent_receipts (policy_version_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_name text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  metadata jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_events (org_id, created_at);
`,
  },
  {
    // OAuth/셀프가입 대비: password_hash 를 nullable 로(소셜 로그인은 비번 없음) +
    // provider/google_sub 추가. 멱등(IF NOT EXISTS / DROP NOT NULL 은 반복 안전).
    name: '0001_auth_providers',
    sql: /* sql */ `
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'password';
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub text;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_uq ON users (google_sub) WHERE google_sub IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
`,
  },
  {
    name: '0002_support_posts',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS support_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_slug text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  author_name text NOT NULL,
  contact text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_posts_project ON support_posts (project_slug, category, created_at);
CREATE INDEX IF NOT EXISTS idx_support_posts_status ON support_posts (status, created_at);
`,
  },
  {
    // 조직(프로젝트) 아이콘 브랜딩 — 공개 약관/지원 페이지 헤더에 표시할 로고 URL.
    // 멱등(IF NOT EXISTS), nullable(없으면 이니셜 모노그램 폴백).
    name: '0003_org_logo',
    sql: /* sql */ `
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url text;
`,
  },
  {
    // 정책 공개/비공개 토글 — 노출 제어 전용('public'|'private'), 게시·해시 로직 비접촉.
    // private 이면 무인증 공개 렌더(:orgSlug 경로)·sitemap 에서 404/제외, API 키 경로(v1)는 허용.
    // 기존 행은 DEFAULT 'public' 으로 현행 동작 유지. 멱등(IF NOT EXISTS).
    name: '0004_policy_visibility',
    sql: /* sql */ `
ALTER TABLE policies ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';
`,
  },
  {
    // 중앙 문의(Inquiry) 접수함 — 공개 게시판(support_posts)과 달리 비공개 접수 전용.
    // site_slug 가 1차 축: 형제 사이트 다수는 DB 조직 없이 정적 포트폴리오 카탈로그로만 존재한다.
    // org_id 는 DB 조직(organizations) 매치 시에만 연결(조직 삭제 시 문의는 남기고 연결만 해제).
    name: '0005_inquiries',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_slug text NOT NULL,
  org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'contact',
  status text NOT NULL DEFAULT 'new',
  title text NOT NULL,
  body text NOT NULL,
  contact_email text,
  origin_url text,
  user_agent text,
  ip text,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inquiries_site_status ON inquiries (site_slug, status, created_at);
CREATE INDEX IF NOT EXISTS idx_inquiries_site_category ON inquiries (site_slug, category, created_at);
CREATE INDEX IF NOT EXISTS idx_inquiries_site_ip_recent ON inquiries (site_slug, ip, created_at);
`,
  },
  {
    // B2B 플랜 + API 미터링 — organizations.plan('free'|'pro'|'team', 기존 행은 free 유지)과
    // 월별 API 호출 카운터(api_usage: org×yyyymm UPSERT 증가, PK 가 조회 인덱스 겸용).
    // 청구는 mock: 플랜 변경은 audit 결정 기록만, 실제 자금 이동 없음. 멱등(IF NOT EXISTS).
    name: '0006_org_plans_api_usage',
    sql: /* sql */ `
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_changed_at timestamptz;

CREATE TABLE IF NOT EXISTS api_usage (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  yyyymm text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_usage_pk PRIMARY KEY (org_id, yyyymm)
);
`,
  },
  {
    // 약관 의뢰 중계(Brokerage) — 의뢰(조직 귀속)·제안·스레드·전문가 프로필.
    // 의뢰자 조직과 전문가(사용자)를 잇는 크로스-조직 마켓플레이스. 금액은 메타데이터(자금 이동 없음).
    // 제안/메시지는 사용자(FK 없는 스냅샷)에 귀속해 사용자 삭제와 분리한다. 멱등(IF NOT EXISTS).
    name: '0007_brokerage',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requester_user_id uuid,
  requester_name text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  service_type text NOT NULL DEFAULT 'draft',
  policy_type text NOT NULL DEFAULT 'custom',
  jurisdiction text NOT NULL DEFAULT 'KR',
  budget_min integer,
  budget_max integer,
  deadline timestamptz,
  status text NOT NULL DEFAULT 'open',
  visibility text NOT NULL DEFAULT 'public',
  accepted_proposal_id uuid,
  assigned_provider_user_id uuid,
  assigned_provider_org_id uuid,
  assigned_provider_name text,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON service_requests (status, created_at);
CREATE INDEX IF NOT EXISTS idx_requests_org ON service_requests (requester_org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_requests_provider ON service_requests (assigned_provider_user_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_market ON service_requests (visibility, status, created_at);

CREATE TABLE IF NOT EXISTS request_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  provider_user_id uuid NOT NULL,
  provider_org_id uuid,
  provider_name text NOT NULL,
  message text NOT NULL,
  quoted_amount integer,
  estimated_days integer,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposals_request_provider_uq UNIQUE (request_id, provider_user_id)
);
CREATE INDEX IF NOT EXISTS idx_proposals_request ON request_proposals (request_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_provider ON request_proposals (provider_user_id, created_at);

CREATE TABLE IF NOT EXISTS request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  author_user_id uuid,
  author_name text NOT NULL,
  author_role text NOT NULL DEFAULT 'requester',
  kind text NOT NULL DEFAULT 'message',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_request_messages ON request_messages (request_id, created_at);

CREATE TABLE IF NOT EXISTS provider_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  headline text NOT NULL,
  bio text NOT NULL,
  specialties text NOT NULL DEFAULT '',
  jurisdictions text NOT NULL DEFAULT 'KR',
  hourly_rate integer,
  contact text,
  verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  completed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_providers_active ON provider_profiles (active, verified, completed_count);
CREATE INDEX IF NOT EXISTS idx_providers_org ON provider_profiles (org_id);
`,
  },
  {
    // 전문가 평점·후기 — 완료 의뢰에 대한 의뢰자의 평가(의뢰당 1건, unique). 별점은 1~5.
    // provider_user_id 는 FK 없는 스냅샷, request_id 는 의뢰 삭제 시 함께 삭제. 멱등(IF NOT EXISTS).
    name: '0008_provider_reviews',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS provider_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id uuid NOT NULL,
  request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  reviewer_org_id uuid,
  reviewer_user_id uuid,
  reviewer_name text NOT NULL,
  rating integer NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_request_uq UNIQUE (request_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_provider ON provider_reviews (provider_user_id, created_at);
`,
  },
  {
    // 인앱 알림 — 중계 이벤트(제안·수락·진행·납품·완료·평가·메시지)를 수신자에게 통지.
    // user_id 는 FK 없는 스냅샷, request_id 는 의뢰 삭제 시 함께 삭제. 멱등(IF NOT EXISTS).
    name: '0009_notifications',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  request_id uuid REFERENCES service_requests(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, read_at);
`,
  },
  {
    // 모의 에스크로 — service_requests 에 상태/금액 컬럼 추가(자금 이동 없음, 결정·표시 전용).
    // 기존 행은 DEFAULT 'none'. 멱등(IF NOT EXISTS).
    name: '0010_escrow',
    sql: /* sql */ `
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS escrow_status text NOT NULL DEFAULT 'none';
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS escrow_amount integer;
`,
  },
  {
    // 분쟁·검수 워크플로 — 참여자 신고/이의제기 큐 표시와 분쟁 사유 메모.
    // 운영자 화면은 flagged=true 로 분쟁 큐를 조회한다. 멱등(IF NOT EXISTS).
    name: '0011_disputes',
    sql: /* sql */ `
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS dispute_note text;
CREATE INDEX IF NOT EXISTS idx_requests_flagged ON service_requests (flagged, updated_at);
`,
  },
  {
    // 파일 첨부 — 참고자료·산출물 파일 메타데이터. 실제 객체는 외부 S3/R2 호환 스토리지에 저장.
    // message_id 는 업로드 직후 null 이고 메시지 전송 시 연결된다. 멱등(IF NOT EXISTS).
    name: '0012_request_attachments',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS request_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  message_id uuid REFERENCES request_messages(id) ON DELETE CASCADE,
  uploader_user_id uuid,
  uploader_name text NOT NULL,
  uploader_role text NOT NULL DEFAULT 'requester',
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  storage_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_request_attachments_request ON request_attachments (request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_request_attachments_message ON request_attachments (message_id, created_at);
CREATE INDEX IF NOT EXISTS idx_request_attachments_uploader ON request_attachments (uploader_user_id, created_at);
`,
  },
]
