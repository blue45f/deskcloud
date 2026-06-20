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
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_publishable_key_uq UNIQUE (publishable_key),
  CONSTRAINT tenants_secret_key_hash_uq UNIQUE (secret_key_hash)
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  kind text NOT NULL,
  title text,
  member_ids jsonb NOT NULL,
  dm_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_tenant_dmkey_uq UNIQUE (tenant_id, dm_key)
);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_created ON conversations (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  sender_member_id text,
  body text NOT NULL,
  attachments jsonb,
  system boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_created ON messages (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS receipts (
  conversation_id uuid NOT NULL,
  member_id text NOT NULL,
  last_read_message_id uuid,
  last_read_at timestamptz,
  read_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receipts_pk PRIMARY KEY (conversation_id, member_id)
);
`,
  },
  {
    name: '0001_tenant_visits',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS tenant_visits (
  tenant_id uuid NOT NULL,
  day date NOT NULL,
  visitors integer NOT NULL DEFAULT 0,
  pageviews integer NOT NULL DEFAULT 0,
  CONSTRAINT tenant_visits_pk PRIMARY KEY (tenant_id, day)
);
CREATE INDEX IF NOT EXISTS idx_tenant_visits_tenant_day ON tenant_visits (tenant_id, day);

CREATE TABLE IF NOT EXISTS tenant_visit_uniques (
  tenant_id uuid NOT NULL,
  day date NOT NULL,
  visitor_id text NOT NULL,
  CONSTRAINT tenant_visit_uniques_pk PRIMARY KEY (tenant_id, day, visitor_id)
);
`,
  },
]
