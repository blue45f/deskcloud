import {
  DEFAULT_MAX_UPLOAD_BYTES,
  type Plan,
} from '@mediadesk/shared'

export const APP_CONFIG = Symbol('APP_CONFIG')

export type DeploymentMode = 'self-hosted' | 'saas'
export type StorageDriver = 'local' | 's3'

export interface AppConfig {
  /** 'self-hosted'(첫 부팅 시 데모 테넌트 시드) | 'saas'(멀티테넌트, 가입형) */
  mode: DeploymentMode
  port: number
  webOrigin: string
  /** 자산 공개 URL 베이스(비면 요청 host 추론). */
  publicBaseUrl: string | null
  /** 있으면 PostgreSQL, 없으면 PGlite 임베드 폴백 */
  databaseUrl: string | null
  pgliteDir: string
  /** 스토리지 어댑터 */
  storageDriver: StorageDriver
  storageLocalDir: string
  derivativeCacheDir: string
  /** S3 스텁 설정(값이 있어도 실제 호출은 일어나지 않음). */
  s3: {
    bucket: string | null
    region: string | null
    endpoint: string | null
    publicBaseUrl: string | null
  }
  /** 업로드 한도 */
  maxUploadBytes: number
  /** free 플랜 소프트 캡 */
  freePlanMaxBytes: number
  freePlanMaxCount: number
  /** 어드민 마스터 토큰 — X-Admin-Token 헤더와 일치하면 어떤 테넌트든 관리 가능. */
  adminToken: string
}

function envBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback
  return v === 'true' || v === '1'
}

function envInt(v: string | undefined, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback
}

export function loadConfig(): AppConfig {
  const mode: DeploymentMode = process.env.MEDIADESK_MODE === 'saas' ? 'saas' : 'self-hosted'
  const storageDriver: StorageDriver = process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local'
  return {
    mode,
    port: envInt(process.env.PORT, 4191),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5291',
    publicBaseUrl: process.env.PUBLIC_BASE_URL?.trim() || null,
    databaseUrl: process.env.DATABASE_URL?.trim() || null,
    pgliteDir: process.env.PGLITE_DIR ?? '.data/pglite',
    storageDriver,
    storageLocalDir: process.env.STORAGE_LOCAL_DIR ?? '.data/uploads',
    derivativeCacheDir: process.env.DERIVATIVE_CACHE_DIR ?? '.data/derivatives',
    s3: {
      bucket: process.env.S3_BUCKET?.trim() || null,
      region: process.env.S3_REGION?.trim() || null,
      endpoint: process.env.S3_ENDPOINT?.trim() || null,
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL?.trim() || null,
    },
    maxUploadBytes: envInt(process.env.MAX_UPLOAD_BYTES, DEFAULT_MAX_UPLOAD_BYTES),
    freePlanMaxBytes: envInt(process.env.FREE_PLAN_MAX_BYTES, 100 * 1024 * 1024),
    freePlanMaxCount: envInt(process.env.FREE_PLAN_MAX_COUNT, 500),
    adminToken: process.env.ADMIN_TOKEN?.trim() || 'dev-admin-token-change-me',
  }
}

/** self-hosted 는 항상 시드, saas 는 MEDIADESK_SEED=true 일 때만. */
export const isSeedingEnabled = (cfg: AppConfig): boolean =>
  cfg.mode === 'self-hosted' || envBool(process.env.MEDIADESK_SEED, false)

/** plan 별 소프트 캡(pro 는 무제한 → null). */
export function planCaps(
  cfg: AppConfig,
  plan: Plan
): { maxBytes: number | null; maxCount: number | null } {
  if (plan === 'pro') return { maxBytes: null, maxCount: null }
  return { maxBytes: cfg.freePlanMaxBytes, maxCount: cfg.freePlanMaxCount }
}
