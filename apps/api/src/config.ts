import { DEFAULT_CHAT_PATH } from '@chatdesk/shared'

export const APP_CONFIG = Symbol('APP_CONFIG')

export type DeploymentMode = 'self-hosted' | 'saas'

export interface AppConfig {
  /** 'self-hosted'(첫 부팅 시 데모 테넌트·대화 시드) | 'saas'(멀티테넌트, 가입형) */
  mode: DeploymentMode
  port: number
  webOrigin: string
  /** socket.io 마운트 경로(게이트웨이 호환 — 트레일링 슬래시 금지). */
  chatPath: string
  /** 있으면 PostgreSQL, 없으면 PGlite 임베드 폴백 */
  databaseUrl: string | null
  pgliteDir: string
  /** 어드민 API 게이트 토큰 — X-Admin-Token 헤더와 일치해야 통과. */
  adminToken: string
  /** 멤버 토큰 HMAC 서명용 명시 시크릿(없으면 sk 파생). */
  memberTokenSecret: string | null
}

function envBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback
  return v === 'true' || v === '1'
}

function envInt(v: string | undefined, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fallback
}

/** CHAT_PATH 정규화 — 선행 슬래시 보장, 트레일링 슬래시 제거(게이트웨이 정확 매칭). */
export function normalizeChatPath(raw: string | undefined): string {
  const p = (raw ?? DEFAULT_CHAT_PATH).trim() || DEFAULT_CHAT_PATH
  const withLead = p.startsWith('/') ? p : `/${p}`
  const trimmed = withLead.replace(/\/+$/, '')
  return trimmed === '' ? DEFAULT_CHAT_PATH : trimmed
}

export function loadConfig(): AppConfig {
  const mode: DeploymentMode = process.env.CHATDESK_MODE === 'saas' ? 'saas' : 'self-hosted'
  return {
    mode,
    port: envInt(process.env.PORT, 4094),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5294',
    chatPath: normalizeChatPath(process.env.CHAT_PATH),
    databaseUrl: process.env.DATABASE_URL?.trim() || null,
    pgliteDir: process.env.PGLITE_DIR ?? '.data/pglite',
    adminToken: process.env.ADMIN_TOKEN?.trim() || 'dev-admin-token-change-me',
    memberTokenSecret: process.env.MEMBER_TOKEN_SECRET?.trim() || null,
  }
}

/** self-hosted 는 항상 시드, saas 는 CHATDESK_SEED=true 일 때만. */
export const isSeedingEnabled = (cfg: AppConfig): boolean =>
  cfg.mode === 'self-hosted' || envBool(process.env.CHATDESK_SEED, false)
