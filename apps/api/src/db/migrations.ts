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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_slug_uq UNIQUE (slug),
  CONSTRAINT tenants_pk_uq UNIQUE (publishable_key),
  CONSTRAINT tenants_skhash_uq UNIQUE (secret_key_hash)
);

CREATE TABLE IF NOT EXISTS end_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  CONSTRAINT end_users_tenant_email_uq UNIQUE (tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_end_users_tenant_created ON end_users (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions (tenant_id);

CREATE TABLE IF NOT EXISTS usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  metric text NOT NULL,
  count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usage_tenant_metric_uq UNIQUE (tenant_id, metric)
);
`,
  },
  {
    // 트래픽/방문자 추적 — 일별 버킷(traffic_daily) + 당일 방문자 seen-set(visitor_seen).
    // 가입과 달리 페이지 방문은 신규 기능이라 과거 백필 불가(카운트는 배포 시점부터). pg·PGlite 동일.
    name: '0001_traffic_daily',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS traffic_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  day date NOT NULL,
  visits bigint NOT NULL DEFAULT 0,
  uniques bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT traffic_daily_tenant_day_uq UNIQUE (tenant_id, day)
);
CREATE INDEX IF NOT EXISTS idx_traffic_daily_tenant_day ON traffic_daily (tenant_id, day);

CREATE TABLE IF NOT EXISTS visitor_seen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  day date NOT NULL,
  vid_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visitor_seen_uq UNIQUE (tenant_id, day, vid_hash)
);
`,
  },
]
