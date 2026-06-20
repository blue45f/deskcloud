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
  plan text NOT NULL DEFAULT 'free',
  publishable_key text NOT NULL,
  secret_key_hash text NOT NULL,
  secret_key_lookup text NOT NULL,
  cors_origins jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_slug_uq UNIQUE (slug),
  CONSTRAINT tenants_publishable_uq UNIQUE (publishable_key)
);
CREATE INDEX IF NOT EXISTS idx_tenants_secret_lookup ON tenants (secret_key_lookup);

CREATE TABLE IF NOT EXISTS file_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  key text NOT NULL,
  filename text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL,
  visibility text NOT NULL DEFAULT 'public',
  storage_driver text NOT NULL DEFAULT 'postgres',
  storage_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT file_objects_tenant_key_uq UNIQUE (tenant_id, key)
);
CREATE INDEX IF NOT EXISTS idx_file_objects_tenant_created ON file_objects (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_file_objects_tenant_visibility ON file_objects (tenant_id, visibility);

CREATE TABLE IF NOT EXISTS file_blobs (
  file_id uuid PRIMARY KEY,
  bytes bytea NOT NULL
);
`,
  },
  {
    name: '0001_visits',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS site_visit_days (
  day date PRIMARY KEY,
  visitors integer NOT NULL DEFAULT 0,
  pageviews integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS site_visitors (
  day date NOT NULL,
  visitor_hash text NOT NULL,
  CONSTRAINT site_visitors_pk PRIMARY KEY (day, visitor_hash)
);
`,
  },
]
