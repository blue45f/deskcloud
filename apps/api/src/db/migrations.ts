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
  posts_count integer NOT NULL DEFAULT 0,
  reads_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_publishable_key_uq UNIQUE (publishable_key),
  CONSTRAINT tenants_slug_uq UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'board',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boards_tenant_slug_uq UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_boards_tenant ON boards (tenant_id);

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  board_id uuid NOT NULL,
  author_member_id text NOT NULL,
  author_name text NOT NULL,
  title text,
  body text NOT NULL,
  body_html text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  pinned boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'visible',
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  reply_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_tenant_board_status ON posts (tenant_id, board_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_tenant_status_created ON posts (tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_posts_board_pinned ON posts (board_id, pinned);

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  post_id uuid NOT NULL,
  parent_id uuid,
  author_member_id text NOT NULL,
  author_name text NOT NULL,
  body text NOT NULL,
  body_html text NOT NULL,
  status text NOT NULL DEFAULT 'visible',
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_tenant_post ON comments (tenant_id, post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id);

CREATE TABLE IF NOT EXISTS reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  member_id text NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reactions_unique UNIQUE (tenant_id, target_type, target_id, member_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_reactions_target ON reactions (tenant_id, target_type, target_id);
`,
  },
  {
    // 일별 방문 집계 — 트래픽/방문자 대시보드용. readsCount 는 단조 증가 정수라
    // "오늘" 을 분리할 수 없어, (tenant_id, day) 버킷에 방문(visits)·고유 방문자
    // (unique_visitors)를 누적한다. 고유 방문자는 daily_visitor_seen 으로 중복 제거.
    // 이 릴리스부터 데이터가 쌓이므로 이전 날짜는 정당하게 0 (백필하지 않음).
    name: '0001_daily_visits',
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS daily_visits (
  tenant_id uuid NOT NULL,
  day date NOT NULL,
  visits integer NOT NULL DEFAULT 0,
  unique_visitors integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, day)
);
CREATE INDEX IF NOT EXISTS idx_daily_visits_tenant_day ON daily_visits (tenant_id, day);

CREATE TABLE IF NOT EXISTS daily_visitor_seen (
  tenant_id uuid NOT NULL,
  day date NOT NULL,
  member_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, day, member_id)
);
`,
  },
]
