import { DEFAULT_ACCESS_TTL_SECONDS } from '@authdesk/shared'

export const APP_CONFIG = Symbol('APP_CONFIG')

export type DeploymentMode = 'self-hosted' | 'saas'

export interface AppConfig {
  /** 'self-hosted'(첫 부팅 시 데모 시드) | 'saas'(멀티테넌트, 가입형) */
  mode: DeploymentMode
  port: number
  webOrigin: string
  /** 있으면 PostgreSQL, 없으면 PGlite 임베드 폴백 */
  databaseUrl: string | null
  pgliteDir: string
  /** secret 키 해시 pepper — SHA-256(키 + pepper). */
  keyPepper: string
  /** end-user 세션 JWT 서명 비밀의 베이스. 테넌트별 비밀은 HMAC(base, tenantId)로 파생. */
  jwtSecret: string
  /** end-user 액세스 토큰 수명(초). */
  accessTtlSeconds: number
  /** 어드민 API 게이트 토큰 — X-Admin-Token 헤더와 일치해야 통과. */
  adminToken: string
}

function envBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback
  return v === 'true' || v === '1'
}

export function loadConfig(): AppConfig {
  const mode: DeploymentMode = process.env.AUTHDESK_MODE === 'saas' ? 'saas' : 'self-hosted'
  return {
    mode,
    port: Number(process.env.PORT ?? 4110),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5310',
    databaseUrl: process.env.DATABASE_URL?.trim() || null,
    pgliteDir: process.env.PGLITE_DIR ?? '.data/pglite',
    keyPepper: process.env.AUTHDESK_KEY_PEPPER?.trim() || 'dev-pepper-change-me',
    jwtSecret: process.env.AUTHDESK_JWT_SECRET?.trim() || 'dev-jwt-secret-change-me',
    accessTtlSeconds: Number(process.env.AUTHDESK_ACCESS_TTL ?? DEFAULT_ACCESS_TTL_SECONDS),
    adminToken: process.env.ADMIN_TOKEN?.trim() || 'dev-admin-token-change-me',
  }
}

/** self-hosted 는 항상 시드, saas 는 AUTHDESK_SEED=true 일 때만. */
export const isSeedingEnabled = (cfg: AppConfig): boolean =>
  cfg.mode === 'self-hosted' || envBool(process.env.AUTHDESK_SEED, false)
