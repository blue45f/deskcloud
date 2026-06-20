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
  cors_origins jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_slug_uq UNIQUE (slug),
  CONSTRAINT tenants_publishable_uq UNIQUE (publishable_key)
);
CREATE INDEX IF NOT EXISTS idx_tenants_secret_hash ON tenants (secret_key_hash);

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns (tenant_id, status);

CREATE TABLE IF NOT EXISTS creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  slot_key text NOT NULL,
  image_url text NOT NULL,
  link_url text NOT NULL,
  alt text NOT NULL,
  weight integer NOT NULL DEFAULT 1,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_creatives_tenant_slot ON creatives (tenant_id, slot_key);
CREATE INDEX IF NOT EXISTS idx_creatives_campaign ON creatives (campaign_id);

CREATE TABLE IF NOT EXISTS slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  key text NOT NULL,
  label text,
  sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slots_tenant_key_uq UNIQUE (tenant_id, key)
);
`,
  },
  {
    // Seeds the canonical "<surface>-spotlight-<n>" slots + a campaign + one
    // creative each, for the demo tenant (slug='demo'). These are the default
    // slot keys the sibling apps' SponsoredX rails serve, so an app pointed at
    // this API with pk_demo shows content out-of-box. Plain idempotent SQL
    // (no plpgsql) — safe on PostgreSQL and PGlite; no-ops when the demo tenant
    // is absent (ADDESK_SEED_DEMO=false).
    name: '0001_seed_sibling_spotlights',
    sql: /* sql */ `
INSERT INTO slots (tenant_id, key, label, sizes)
SELECT t.id, v.key, v.label, sz.sizes::jsonb
FROM tenants t
CROSS JOIN (VALUES
  ('home-spotlight-1', '홈 스포트라이트 1'),
  ('home-spotlight-2', '홈 스포트라이트 2'),
  ('home-spotlight-3', '홈 스포트라이트 3'),
  ('partners-spotlight-1', '제작사 추천 1'),
  ('partners-spotlight-2', '제작사 추천 2'),
  ('partners-spotlight-3', '제작사 추천 3'),
  ('discover-spotlight-1', '모임 추천 1'),
  ('discover-spotlight-2', '모임 추천 2'),
  ('discover-spotlight-3', '모임 추천 3'),
  ('species-spotlight-1', '반려동물 추천 1'),
  ('species-spotlight-2', '반려동물 추천 2'),
  ('species-spotlight-3', '반려동물 추천 3'),
  ('market-spotlight-1', '프로젝트 추천 1'),
  ('market-spotlight-2', '프로젝트 추천 2'),
  ('market-spotlight-3', '프로젝트 추천 3')
) AS v(key, label)
CROSS JOIN (VALUES ('["1200x675"]')) AS sz(sizes)
WHERE t.slug = 'demo'
ON CONFLICT (tenant_id, key) DO NOTHING;

INSERT INTO campaigns (tenant_id, name, status)
SELECT t.id, 'Sibling Spotlights', 'active'
FROM tenants t
WHERE t.slug = 'demo'
  AND NOT EXISTS (
    SELECT 1 FROM campaigns c
    WHERE c.tenant_id = t.id AND c.name = 'Sibling Spotlights'
  );

INSERT INTO creatives (tenant_id, campaign_id, slot_key, image_url, link_url, alt, weight)
SELECT t.id, camp.id, v.slot_key,
  'https://picsum.photos/seed/ad-' || v.slot_key || '/1200/675',
  'https://example.com/' || v.slot_key,
  v.alt, 1
FROM tenants t
JOIN campaigns camp ON camp.tenant_id = t.id AND camp.name = 'Sibling Spotlights'
CROSS JOIN (VALUES
  ('home-spotlight-1', '스폰서 추천'),
  ('home-spotlight-2', '스폰서 추천'),
  ('home-spotlight-3', '스폰서 추천'),
  ('partners-spotlight-1', '추천 제작사'),
  ('partners-spotlight-2', '추천 제작사'),
  ('partners-spotlight-3', '추천 제작사'),
  ('discover-spotlight-1', '추천 모임'),
  ('discover-spotlight-2', '추천 모임'),
  ('discover-spotlight-3', '추천 모임'),
  ('species-spotlight-1', '추천 반려동물'),
  ('species-spotlight-2', '추천 반려동물'),
  ('species-spotlight-3', '추천 반려동물'),
  ('market-spotlight-1', '추천 프로젝트'),
  ('market-spotlight-2', '추천 프로젝트'),
  ('market-spotlight-3', '추천 프로젝트')
) AS v(slot_key, alt)
WHERE t.slug = 'demo'
  AND NOT EXISTS (
    SELECT 1 FROM creatives c
    WHERE c.tenant_id = t.id AND c.campaign_id = camp.id AND c.slot_key = v.slot_key
  );
`,
  },
  {
    // Admin-uploaded ad images. Stored as base64 text (no object storage) so the
    // same schema works on PostgreSQL/Neon and PGlite. Served publicly by opaque
    // UUID; the absolute URL is used as a creative's image_url.
    name: '0002_ad_uploads',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS ad_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  content_type text NOT NULL,
  data text NOT NULL,
  bytes integer NOT NULL,
  filename text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_uploads_tenant ON ad_uploads (tenant_id);
`,
  },
  {
    // Daily-bucket ad-serve visits per tenant. A successful serve (served:true) is
    // the honest visitor/traffic signal on the tenant's surface, so serve() UPSERTs
    // (tenant_id, day) here. Read by stats() for "오늘 방문자". Tracked from deploy
    // day (no backfill) — surfaced in the UI as 배포 이후 집계, never a fake history.
    // PK (tenant_id, day) makes the upsert idempotent and Postgres/PGlite-safe.
    name: '0003_ad_visits',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS ad_visits (
  tenant_id uuid NOT NULL,
  day date NOT NULL,
  visits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, day)
);
CREATE INDEX IF NOT EXISTS idx_ad_visits_tenant ON ad_visits (tenant_id);
`,
  },
]
