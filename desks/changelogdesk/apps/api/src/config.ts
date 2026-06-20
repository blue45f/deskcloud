import { DEFAULT_FREE_MONTHLY_LIMIT } from '@changelogdesk/shared'

export const APP_CONFIG = Symbol('APP_CONFIG')

export type DeploymentMode = 'self-hosted' | 'saas'

export interface AppConfig {
  /** 'self-hosted'(첫 부팅 시 데모 테넌트 시드) | 'saas'(멀티테넌트, 가입형) */
  mode: DeploymentMode
  port: number
  webOrigin: string
  /** 있으면 PostgreSQL, 없으면 PGlite 임베드 폴백 */
  databaseUrl: string | null
  pgliteDir: string
  /** 셀프호스트 글로벌 어드민 토큰 — X-Admin-Token 헤더와 일치하면 모든 테넌트 어드민 통과. */
  adminToken: string
  /** free 플랜 월간 공개 호출 소프트 한도. */
  freeMonthlyLimit: number
}

function envBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback
  return v === 'true' || v === '1'
}

export function loadConfig(): AppConfig {
  const mode: DeploymentMode = process.env.CHANGELOGDESK_MODE === 'saas' ? 'saas' : 'self-hosted'
  return {
    mode,
    port: Number(process.env.PORT ?? 4095),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5295',
    databaseUrl: process.env.DATABASE_URL?.trim() || null,
    pgliteDir: process.env.PGLITE_DIR ?? '.data/pglite',
    adminToken: process.env.ADMIN_TOKEN?.trim() || 'dev-admin-token-change-me',
    freeMonthlyLimit:
      Number(process.env.FREE_PLAN_MONTHLY_LIMIT) || DEFAULT_FREE_MONTHLY_LIMIT,
  }
}

/** self-hosted 는 항상 시드, saas 는 CHANGELOGDESK_SEED=true 일 때만. */
export const isSeedingEnabled = (cfg: AppConfig): boolean =>
  cfg.mode === 'self-hosted' || envBool(process.env.CHANGELOGDESK_SEED, false)
