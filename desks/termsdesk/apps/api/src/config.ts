import type { DeploymentMode } from '@termsdesk/shared'

export const APP_CONFIG = Symbol('APP_CONFIG')

export interface AppConfig {
  /** 'self-hosted'(싱글테넌트, 사내 설치) | 'saas'(멀티테넌트) */
  mode: DeploymentMode
  port: number
  webOrigin: string
  /** 있으면 PostgreSQL, 없으면 PGlite 임베드 폴백 */
  databaseUrl: string | null
  pgliteDir: string
  jwtSecret: string
  seedAdminEmail: string
  seedAdminPassword: string
  publicCacheTtl: number
  /** 셀프서비스 이메일 회원가입 허용(새 조직+소유자 생성). */
  allowSignup: boolean
  /** Google 로그인 클라이언트 ID(없으면 Google 버튼 숨김). */
  googleClientId: string | null
  /** 로그인 없이 둘러보기(데모 게스트 세션) 허용. */
  allowDemo: boolean
  /** 공개 문의 접수의 Origin 소프트 허용 목록(콤마 구분 env). 비어 있으면 전부 허용. */
  inquiryAllowedOrigins: string[]
  /** 브로커리지 첨부 파일 S3/R2 호환 저장소. bucket 이 없으면 업로드 기능 비활성. */
  attachmentStorage?: {
    bucket: string | null
    region: string
    endpoint: string | null
    forcePathStyle: boolean
    maxBytes: number
  }
}

function envBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback
  return v === 'true' || v === '1'
}

export function loadConfig(): AppConfig {
  const mode = (process.env.TERMSDESK_MODE === 'saas' ? 'saas' : 'self-hosted') as DeploymentMode
  return {
    mode,
    port: Number(process.env.PORT ?? 4070),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5270',
    databaseUrl: process.env.DATABASE_URL?.trim() || null,
    pgliteDir: process.env.PGLITE_DIR ?? '.data/pglite',
    jwtSecret: process.env.JWT_SECRET ?? 'dev-only-change-me-please',
    seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@termsdesk.local',
    seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'termsdesk-admin',
    publicCacheTtl: Number(process.env.PUBLIC_CACHE_TTL ?? 60),
    allowSignup: envBool(process.env.TERMSDESK_ALLOW_SIGNUP, true),
    googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || null,
    allowDemo: envBool(process.env.TERMSDESK_ALLOW_DEMO, true),
    inquiryAllowedOrigins: (process.env.INQUIRY_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((v) => v.trim().replace(/\/$/, '').toLowerCase())
      .filter(Boolean),
    attachmentStorage: {
      bucket: process.env.BROKERAGE_ATTACHMENTS_S3_BUCKET?.trim() || null,
      region:
        process.env.BROKERAGE_ATTACHMENTS_S3_REGION?.trim() ||
        process.env.AWS_REGION?.trim() ||
        'ap-northeast-2',
      endpoint: process.env.BROKERAGE_ATTACHMENTS_S3_ENDPOINT?.trim() || null,
      forcePathStyle: envBool(process.env.BROKERAGE_ATTACHMENTS_S3_FORCE_PATH_STYLE, false),
      maxBytes: Number(process.env.BROKERAGE_ATTACHMENTS_MAX_BYTES ?? 10 * 1024 * 1024),
    },
  }
}

export const isSeedingEnabled = (cfg: AppConfig): boolean =>
  cfg.mode === 'self-hosted' || envBool(process.env.TERMSDESK_SEED, false)
