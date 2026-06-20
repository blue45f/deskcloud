import {
  DEFAULT_FREE_PLAN_FILE_CAP,
  DEFAULT_MAX_FILE_BYTES,
  HARD_MAX_FILE_BYTES,
  type StorageDriver,
} from '@filedesk/shared'

export const APP_CONFIG = Symbol('APP_CONFIG')

export type DeploymentMode = 'self-hosted' | 'saas'

/** S3/R2 어댑터 설정 — 모두 채워져야 동작(아니면 StorageNotConfigured). 실제 자격증명은 env 로만. */
export interface S3Config {
  bucket: string | null
  region: string | null
  endpoint: string | null
  accessKeyId: string | null
  secretAccessKey: string | null
  /** public 객체의 외부 베이스 URL(예: CDN). 미지정 시 API 프록시 서빙. */
  publicBaseUrl: string | null
}

export interface AppConfig {
  /** 'saas'(외부 온보딩, 멀티테넌트 가입) | 'self-hosted'(첫 부팅 시 데모 시드) */
  mode: DeploymentMode
  port: number
  webOrigin: string
  /** 있으면 PostgreSQL, 없으면 PGlite 임베드 폴백 */
  databaseUrl: string | null
  pgliteDir: string
  /** 플랫폼 운영자 마스터 토큰 — X-Admin-Token 헤더와 일치하면 어드민 통과. */
  adminToken: string
  /** secret 키 해시·서명 토큰에 섞는 앱 전역 페퍼. */
  keyPepper: string
  /** free 플랜 누적 파일 수 소프트 캡. */
  freePlanFileCap: number
  /** 업로드 최대 바이트(HARD_MAX 로 상한 클램프). */
  maxFileBytes: number
  /** 스토리지 드라이버 — postgres(bytea, v1) | s3(스왑). */
  storageDriver: StorageDriver
  s3: S3Config
}

function envBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback
  return v === 'true' || v === '1'
}

function clampMaxBytes(raw: string | undefined): number {
  const n = Number(raw ?? DEFAULT_MAX_FILE_BYTES)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_FILE_BYTES
  return Math.min(Math.trunc(n), HARD_MAX_FILE_BYTES)
}

export function loadConfig(): AppConfig {
  const mode: DeploymentMode = process.env.FILEDESK_MODE === 'saas' ? 'saas' : 'self-hosted'
  const storageDriver: StorageDriver = process.env.DESK_STORAGE_DRIVER === 's3' ? 's3' : 'postgres'
  return {
    mode,
    port: Number(process.env.PORT ?? 4100),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5300',
    databaseUrl: process.env.DATABASE_URL?.trim() || null,
    pgliteDir: process.env.PGLITE_DIR ?? '.data/pglite',
    adminToken: process.env.ADMIN_TOKEN?.trim() || 'dev-admin-token-change-me',
    keyPepper: process.env.DESK_KEY_PEPPER?.trim() || 'dev-pepper-change-me',
    freePlanFileCap: Number(process.env.FREE_PLAN_FILE_CAP ?? DEFAULT_FREE_PLAN_FILE_CAP),
    maxFileBytes: clampMaxBytes(process.env.MAX_FILE_BYTES),
    storageDriver,
    s3: {
      bucket: process.env.S3_BUCKET?.trim() || null,
      region: process.env.S3_REGION?.trim() || null,
      endpoint: process.env.S3_ENDPOINT?.trim() || null,
      accessKeyId: process.env.S3_ACCESS_KEY_ID?.trim() || null,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY?.trim() || null,
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL?.trim() || null,
    },
  }
}

/** self-hosted 는 항상 시드, saas 는 FILEDESK_SEED=true 일 때만. */
export const isSeedingEnabled = (cfg: AppConfig): boolean =>
  cfg.mode === 'self-hosted' || envBool(process.env.FILEDESK_SEED, false)
