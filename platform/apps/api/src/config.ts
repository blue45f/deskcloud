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
  /** 어드민 API 게이트 토큰 — X-Admin-Token 헤더와 일치해야 통과. */
  adminToken: string
  /** secret 키 해시 페퍼(서버 비밀). */
  keyPepper: string
  /** 빌링 어댑터 제공자 — stub(기본) | toss | stripe. 실제 청구 없음(TEST/STUB). */
  billingProvider: 'stub' | 'toss' | 'stripe'
}

function envBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback
  return v === 'true' || v === '1'
}

export function loadConfig(): AppConfig {
  const mode: DeploymentMode = process.env.DESK_PLATFORM_MODE === 'saas' ? 'saas' : 'self-hosted'
  const provider = process.env.DESK_BILLING_PROVIDER
  return {
    mode,
    port: Number(process.env.PORT ?? 6090),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:6091',
    databaseUrl: process.env.DATABASE_URL?.trim() || null,
    pgliteDir: process.env.PGLITE_DIR ?? '.data/pglite',
    adminToken: process.env.ADMIN_TOKEN?.trim() || 'dev-admin-token-change-me',
    keyPepper: process.env.DESK_KEY_PEPPER?.trim() || '',
    billingProvider: provider === 'toss' || provider === 'stripe' ? provider : 'stub',
  }
}

/** self-hosted 는 항상 시드, saas 는 DESK_PLATFORM_SEED=true 일 때만. */
export const isSeedingEnabled = (cfg: AppConfig): boolean =>
  cfg.mode === 'self-hosted' || envBool(process.env.DESK_PLATFORM_SEED, false)
