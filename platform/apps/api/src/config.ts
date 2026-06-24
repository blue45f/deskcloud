import type { AdminAccount, AdminRole, AdminScope } from '@desk/core/nest'

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
  /** 운영자별 어드민 토큰 계정. */
  adminAccounts: readonly AdminAccount[]
  /** secret 키 해시 페퍼(서버 비밀). */
  keyPepper: string
  /** 빌링 어댑터 제공자 — stub(기본) | toss | stripe. 실제 청구 없음(TEST/STUB). */
  billingProvider: 'stub' | 'toss' | 'stripe'
}

function envBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback
  return v === 'true' || v === '1'
}

const ADMIN_ROLES = new Set<AdminRole>(['owner', 'operator', 'support', 'auditor'])
const ADMIN_SCOPES = new Set<AdminScope>([
  'admin:*',
  'inquiries:read',
  'inquiries:write',
  'workspace:read',
  'tenant:read',
  'tenant:write',
  'billing:read',
  'billing:write',
])

function parseAdminRole(value: string): AdminRole {
  return ADMIN_ROLES.has(value as AdminRole) ? (value as AdminRole) : 'operator'
}

function parseAdminScopes(value: string): AdminScope[] {
  const scopes = value
    .split('+')
    .map((scope) => scope.trim())
    .filter((scope): scope is AdminScope => ADMIN_SCOPES.has(scope as AdminScope))
  return scopes.length > 0 ? scopes : ['inquiries:read']
}

/** appId 허용목록 파싱(+ 구분, 소문자 정규화). 비어있으면 undefined(전역). */
function parseAdminAppIds(value: string | undefined): string[] | undefined {
  if (!value?.trim()) return undefined
  const appIds = value
    .split('+')
    .map((appId) => appId.trim().toLowerCase())
    .filter(Boolean)
  return appIds.length > 0 ? appIds : undefined
}

/**
 * ADMIN_ACCOUNTS 형식:
 *   id|label|role|scope+scope|token|app+app;id|label|role|scope|token
 *
 * 6번째 필드(app+app)는 선택 — 있으면 해당 appId 들만 관리(앱 스코프 토큰), 없으면 전역.
 * 토큰 원문은 환경변수에만 두고, 앱은 메모리에서 비교한다.
 */
export function parseAdminAccounts(raw: string | undefined): AdminAccount[] {
  if (!raw?.trim()) return []
  const accounts: AdminAccount[] = []
  raw
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry, index) => {
      const [id, label, role, scopes, token, appIds] = entry.split('|').map((part) => part.trim())
      if (!id || !label || !token) {
        console.warn(`[env] ADMIN_ACCOUNTS ${index + 1}번째 항목을 파싱하지 못해 건너뜁니다.`)
        return
      }
      accounts.push({
        id,
        label,
        role: parseAdminRole(role),
        scopes: parseAdminScopes(scopes),
        token,
        appIds: parseAdminAppIds(appIds),
      })
    })
  return accounts
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
    adminAccounts: parseAdminAccounts(process.env.ADMIN_ACCOUNTS),
    keyPepper: process.env.DESK_KEY_PEPPER?.trim() || '',
    billingProvider: provider === 'toss' || provider === 'stripe' ? provider : 'stub',
  }
}

/** self-hosted 는 항상 시드, saas 는 DESK_PLATFORM_SEED=true 일 때만. */
export const isSeedingEnabled = (cfg: AppConfig): boolean =>
  cfg.mode === 'self-hosted' || envBool(process.env.DESK_PLATFORM_SEED, false)
