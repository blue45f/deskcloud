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
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  publishable_key text NOT NULL,
  secret_key_hash text NOT NULL,
  cors_origins jsonb NOT NULL DEFAULT '[]'::jsonb,
  plan text NOT NULL DEFAULT 'free',
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_publishable_key_uq UNIQUE (publishable_key),
  CONSTRAINT tenants_slug_uq UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS forbidden_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  pattern text NOT NULL,
  kind text NOT NULL DEFAULT 'substring',
  action text NOT NULL DEFAULT 'block',
  label text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rules_tenant_enabled ON forbidden_rules (tenant_id, enabled);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  reason text NOT NULL,
  reporter_id text,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_tenant_status_created ON reports (tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_tenant_subject ON reports (tenant_id, subject_type, subject_id);

CREATE TABLE IF NOT EXISTS moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  text text NOT NULL,
  verdict text NOT NULL,
  matched_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_score real,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_logs_tenant_created ON moderation_logs (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_logs_tenant_verdict ON moderation_logs (tenant_id, verdict);
`,
  },
]
