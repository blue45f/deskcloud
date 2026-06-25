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

CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT members_tenant_email_uq UNIQUE (tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_members_tenant ON members (tenant_id);

CREATE TABLE IF NOT EXISTS usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  period text NOT NULL,
  metric text NOT NULL,
  count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usage_tenant_period_metric_uq UNIQUE (tenant_id, period, metric)
);
CREATE INDEX IF NOT EXISTS idx_usage_tenant_period ON usage_counters (tenant_id, period);
`,
  },
  {
    name: '0001_subscriptions',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'none',
  provider text NOT NULL DEFAULT 'stub',
  provider_subscription_id text,
  period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_tenant_uq UNIQUE (tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions (tenant_id);
`,
  },
  {
    name: '0002_inquiries',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  title text NOT NULL,
  body text NOT NULL,
  contact_email text,
  origin_url text,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inquiries_app ON inquiries (app_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_app_created ON inquiries (app_id, created_at);
`,
  },
  {
    name: '0003_daily_visits',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS daily_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text NOT NULL,
  day text NOT NULL,
  visits bigint NOT NULL DEFAULT 0,
  uniques bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_visits_app_day_uq UNIQUE (app_id, day)
);
CREATE INDEX IF NOT EXISTS idx_daily_visits_app ON daily_visits (app_id);
`,
  },
  {
    name: '0004_inquiry_status_index',
    sql: /* sql */ `
CREATE INDEX IF NOT EXISTS idx_inquiries_app_status_created ON inquiries (app_id, status, created_at);
`,
  },
  {
    name: '0005_inquiry_origin_host',
    sql: /* sql */ `
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS origin_host text;

UPDATE inquiries
SET origin_host = lower(split_part(regexp_replace(origin_url, '^https?://', ''), '/', 1))
WHERE origin_url IS NOT NULL
  AND origin_host IS NULL;

CREATE INDEX IF NOT EXISTS idx_inquiries_app_origin_created
  ON inquiries (app_id, origin_host, created_at);
CREATE INDEX IF NOT EXISTS idx_inquiries_app_origin_status_created
  ON inquiries (app_id, origin_host, status, created_at);
`,
  },
  {
    name: '0006_favorites',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text NOT NULL,
  owner_key text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT favorites_app_owner_uq UNIQUE (app_id, owner_key)
);
CREATE INDEX IF NOT EXISTS idx_favorites_app ON favorites (app_id);
`,
  },
]
