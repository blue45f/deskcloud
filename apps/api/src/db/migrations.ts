export type MigrationKind = 'postgres' | 'pglite'

export interface Migration {
  name: string
  sql: string
  /**
   * 이 마이그레이션을 적용할 드라이버. 미지정 시 양쪽 모두.
   * tsvector GIN 인덱스처럼 Postgres 전용 최적화는 ['postgres'] 로 한정한다
   * (PGlite 도 tsvector 를 지원하지만, 폴백 경로는 LIKE 랭킹을 쓰므로 인덱스가 불필요).
   */
  only?: MigrationKind[]
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
  doc_count integer NOT NULL DEFAULT 0,
  search_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_slug_uq UNIQUE (slug),
  CONSTRAINT tenants_publishable_uq UNIQUE (publishable_key)
);
CREATE INDEX IF NOT EXISTS idx_tenants_secret_lookup ON tenants (secret_key_lookup);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  index_name text NOT NULL,
  doc_id text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  url text,
  category text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attrs jsonb,
  search_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_tenant_index_doc_uq UNIQUE (tenant_id, index_name, doc_id)
);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_index ON documents (tenant_id, index_name);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents (tenant_id, index_name, category);
`,
  },
  {
    // Postgres 전용 — 전문 검색용 tsvector GIN 인덱스(search_text 기반, 'simple' 사전).
    // PGlite 폴백 경로는 LIKE/토큰 랭킹을 쓰므로 이 인덱스를 만들지 않는다.
    name: '0001_documents_fts_gin',
    only: ['postgres'],
    sql: /* sql */ `
CREATE INDEX IF NOT EXISTS idx_documents_fts
  ON documents USING gin (to_tsvector('simple', search_text));
`,
  },
  {
    // 트래픽/방문자 추적 — 일별 버킷(양쪽 드라이버 동일). 비어서 시작해 실 핑으로 누적.
    // total_visits = 누적 페이지뷰, unique_visitors = 그 날 최초 방문 쿠키 수(정직한 '오늘 고유').
    name: '0002_visits',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS visits (
  day date PRIMARY KEY,
  total_visits integer NOT NULL DEFAULT 0,
  unique_visitors integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
`,
  },
]
