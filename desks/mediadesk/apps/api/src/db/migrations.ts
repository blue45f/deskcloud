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
  slug text NOT NULL,
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  publishable_key text NOT NULL,
  -- secret 키는 절대 평문 저장하지 않음 — sha-256 해시만.
  secret_key_hash text NOT NULL,
  cors_origins jsonb NOT NULL DEFAULT '[]'::jsonb,
  storage_driver text NOT NULL DEFAULT 'local',
  -- 사용량 캐시(증분 갱신). 정확도가 의심되면 assets 합계로 재계산.
  usage_bytes bigint NOT NULL DEFAULT 0,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_slug_uq UNIQUE (slug),
  CONSTRAINT tenants_pk_uq UNIQUE (publishable_key)
);

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  -- 테넌트 내부 상대 키(저장 경로·공개 URL 세그먼트). 예: 'avatars/ab12-photo.png'.
  key text NOT NULL,
  folder text,
  content_type text NOT NULL,
  size bigint NOT NULL,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assets_tenant_key_uq UNIQUE (tenant_id, key)
);
CREATE INDEX IF NOT EXISTS idx_assets_tenant_created ON assets (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assets_tenant_folder ON assets (tenant_id, folder);
`,
  },
  {
    // 운영 트래픽 집계 — 일별 버킷(visitors=고유 방문자, hits=총 방문). 롤아웃 시점부터
    // 누적되며 소급 백필은 없다(정직성). 일별 한 행이라 크기는 O(days) 로 작다.
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
