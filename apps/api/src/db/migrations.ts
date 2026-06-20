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
  cors_origins text[] NOT NULL DEFAULT '{}',
  plan text NOT NULL DEFAULT 'free',
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_slug_uq UNIQUE (slug),
  CONSTRAINT tenants_pk_uq UNIQUE (publishable_key)
);
CREATE INDEX IF NOT EXISTS idx_tenants_pk ON tenants (publishable_key);

CREATE TABLE IF NOT EXISTS changelog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  body_markdown text NOT NULL DEFAULT '',
  tag text NOT NULL,
  version text,
  category text,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_entries_tenant_published ON changelog_entries (tenant_id, is_published, published_at);
CREATE INDEX IF NOT EXISTS idx_entries_tenant_created ON changelog_entries (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS read_receipts (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  anon_id text NOT NULL,
  last_seen_entry_id uuid,
  seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT read_receipts_tenant_anon_uq UNIQUE (tenant_id, anon_id)
);
`,
  },
]
