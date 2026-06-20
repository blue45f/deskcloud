import { DEFAULT_AI_MODEL, FREE_PLAN_LIMIT } from '@moderationdesk/shared'

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
  /** 글로벌 어드민 토큰 — X-Admin-Token 헤더와 일치하면 모든 테넌트 어드민 접근(셀프호스트). */
  adminToken: string
  /** 무료 플랜 누적 검사 소프트 한도(초과 시 검사 402). */
  freePlanLimit: number
  /**
   * AI 보조용 Anthropic API 키. 있으면 모더레이션 검사에 Claude 보조 점수를 추가한다.
   * 없으면 AI 경로는 조용히 건너뛰고 규칙 기반만 사용(절대 하드페일 안 함).
   */
  anthropicApiKey: string | null
  /** AI 보조 모델 id(작고 저렴한 모델 권장). 기본 claude-haiku-4-5. */
  aiModel: string
}

function envBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback
  return v === 'true' || v === '1'
}

export function loadConfig(): AppConfig {
  const mode: DeploymentMode = process.env.MODERATIONDESK_MODE === 'saas' ? 'saas' : 'self-hosted'
  const freeLimitRaw = Number(process.env.FREE_PLAN_LIMIT)
  return {
    mode,
    port: Number(process.env.PORT ?? 4092),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5292',
    databaseUrl: process.env.DATABASE_URL?.trim() || null,
    pgliteDir: process.env.PGLITE_DIR ?? '.data/pglite',
    adminToken: process.env.ADMIN_TOKEN?.trim() || 'dev-admin-token-change-me',
    freePlanLimit:
      Number.isFinite(freeLimitRaw) && freeLimitRaw > 0 ? freeLimitRaw : FREE_PLAN_LIMIT,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
    aiModel: process.env.MODERATION_AI_MODEL?.trim() || DEFAULT_AI_MODEL,
  }
}

/** self-hosted 는 항상 시드, saas 는 MODERATIONDESK_SEED=true 일 때만. */
export const isSeedingEnabled = (cfg: AppConfig): boolean =>
  cfg.mode === 'self-hosted' || envBool(process.env.MODERATIONDESK_SEED, false)
