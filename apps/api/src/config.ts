import { DEFAULT_FREE_PLAN_DOC_CAP, SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT } from '@searchdesk/shared'

export const APP_CONFIG = Symbol('APP_CONFIG')

export type DeploymentMode = 'self-hosted' | 'saas'

export interface AppConfig {
  /** 'saas'(외부 온보딩, 멀티테넌트 가입) | 'self-hosted'(첫 부팅 시 데모 시드) */
  mode: DeploymentMode
  port: number
  webOrigin: string
  /** 있으면 PostgreSQL, 없으면 PGlite 임베드 폴백 */
  databaseUrl: string | null
  pgliteDir: string
  /** 플랫폼 운영자 마스터 토큰 — X-Admin-Token 헤더와 일치하면 어드민/색인 통과. */
  adminToken: string
  /** free 플랜 누적 문서 소프트 캡. */
  freePlanDocCap: number
  /** 검색 결과 기본/최대 limit. */
  searchDefaultLimit: number
  searchMaxLimit: number
}

function envBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback
  return v === 'true' || v === '1'
}

export function loadConfig(): AppConfig {
  const mode: DeploymentMode = process.env.SEARCHDESK_MODE === 'self-hosted' ? 'self-hosted' : 'saas'
  return {
    mode,
    port: Number(process.env.PORT ?? 4093),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5293',
    databaseUrl: process.env.DATABASE_URL?.trim() || null,
    pgliteDir: process.env.PGLITE_DIR ?? '.data/pglite',
    adminToken: process.env.ADMIN_TOKEN?.trim() || 'dev-admin-token-change-me',
    freePlanDocCap: Number(process.env.FREE_PLAN_DOC_CAP ?? DEFAULT_FREE_PLAN_DOC_CAP),
    searchDefaultLimit: Number(process.env.SEARCH_DEFAULT_LIMIT ?? SEARCH_DEFAULT_LIMIT),
    searchMaxLimit: Number(process.env.SEARCH_MAX_LIMIT ?? SEARCH_MAX_LIMIT),
  }
}

/** self-hosted 는 항상 시드, saas 는 SEARCHDESK_SEED=true 일 때만. */
export const isSeedingEnabled = (cfg: AppConfig): boolean =>
  cfg.mode === 'self-hosted' || envBool(process.env.SEARCHDESK_SEED, false)
