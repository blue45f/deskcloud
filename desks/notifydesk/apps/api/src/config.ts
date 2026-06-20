import { DEFAULT_FREE_PLAN_CAP } from '@notifydesk/shared'

export const APP_CONFIG = Symbol('APP_CONFIG')

export type DeploymentMode = 'self-hosted' | 'saas'

/** 이메일 어댑터 설정 — SMTP_URL 있으면 SMTP, 없으면 콘솔 로그. */
export interface EmailConfig {
  smtpUrl: string | null
  from: string
}

/** 웹 푸시(VAPID) 설정 — 둘 다 있어야 동작, 아니면 no-op. */
export interface WebPushConfig {
  publicKey: string | null
  privateKey: string | null
  subject: string
}

export interface AppConfig {
  /** 'saas'(외부 온보딩, 멀티테넌트 가입) | 'self-hosted'(첫 부팅 시 데모 시드) */
  mode: DeploymentMode
  port: number
  webOrigin: string
  /** 있으면 PostgreSQL, 없으면 PGlite 임베드 폴백 */
  databaseUrl: string | null
  pgliteDir: string
  /** 플랫폼 운영자 마스터 토큰 — X-Admin-Token 헤더와 일치하면 어드민/발송 통과. */
  adminToken: string
  /** free 플랜 누적 발송 소프트 캡. */
  freePlanCap: number
  email: EmailConfig
  webPush: WebPushConfig
}

function envBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback
  return v === 'true' || v === '1'
}

export function loadConfig(): AppConfig {
  const mode: DeploymentMode = process.env.NOTIFYDESK_MODE === 'self-hosted' ? 'self-hosted' : 'saas'
  return {
    mode,
    port: Number(process.env.PORT ?? 4095),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5295',
    databaseUrl: process.env.DATABASE_URL?.trim() || null,
    pgliteDir: process.env.PGLITE_DIR ?? '.data/pglite',
    adminToken: process.env.ADMIN_TOKEN?.trim() || 'dev-admin-token-change-me',
    freePlanCap: Number(process.env.FREE_PLAN_CAP ?? DEFAULT_FREE_PLAN_CAP),
    email: {
      smtpUrl: process.env.SMTP_URL?.trim() || null,
      from: process.env.EMAIL_FROM?.trim() || 'NotifyDesk <no-reply@notifydesk.local>',
    },
    webPush: {
      publicKey: process.env.VAPID_PUBLIC_KEY?.trim() || null,
      privateKey: process.env.VAPID_PRIVATE_KEY?.trim() || null,
      subject: process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@notifydesk.local',
    },
  }
}

/** self-hosted 는 항상 시드, saas 는 NOTIFYDESK_SEED=true 일 때만. */
export const isSeedingEnabled = (cfg: AppConfig): boolean =>
  cfg.mode === 'self-hosted' || envBool(process.env.NOTIFYDESK_SEED, false)
