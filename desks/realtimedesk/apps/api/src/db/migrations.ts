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
  publishable_key text NOT NULL,
  secret_key_hash text NOT NULL,
  cors_origins jsonb NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  usage_messages integer NOT NULL DEFAULT 0,
  usage_connections integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_publishable_key_uq UNIQUE (publishable_key),
  CONSTRAINT tenants_secret_key_hash_uq UNIQUE (secret_key_hash)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq bigserial NOT NULL,
  tenant_id uuid NOT NULL,
  channel text NOT NULL,
  event text NOT NULL,
  data jsonb,
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_channel_seq ON messages (tenant_id, channel, seq);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_seq ON messages (tenant_id, seq);
`,
  },
  {
    name: '0001_visits',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS visits (
  day date PRIMARY KEY,
  visitors integer NOT NULL DEFAULT 0,
  hits integer NOT NULL DEFAULT 0
);
`,
  },
]
