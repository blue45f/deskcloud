import { z } from 'zod'

/**
 * 백엔드 환경 변수 검증 (NON-FATAL).
 *
 * boot 시 한 번 `validateEnv()` 를 호출하면 `process.env` 를 Zod 로 안전 파싱하고
 * 문제가 있으면 경고 로그만 남깁니다 — 절대 throw/exit 하지 않습니다(라이브 부팅 보호).
 * 실제 설정 로딩은 `loadConfig()`(config.ts) 가 그대로 담당합니다. 여기서는 검증만 ADD.
 */

/** 운영(production)에서 사용하면 위험한, 개발 전용 기본값 목록. */
const UNSAFE_PROD_DEFAULTS: Readonly<Record<string, readonly string[]>> = {
  ADMIN_TOKEN: ['dev-admin-token-change-me', 'change-me-in-production', 'changeme', 'admin'],
  DESK_KEY_PEPPER: ['dev-pepper-change-me', 'change-me-in-production', 'changeme', 'pepper'],
}

const optionalNonEmpty = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal('').transform(() => undefined))

const numericString = z.string().trim().regex(/^\d+$/, '정수여야 합니다').optional()

/** 모든 키는 선택값입니다 — 누락 시 config.ts 의 기본값으로 폴백하기 때문입니다. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
  FILEDESK_MODE: z.enum(['self-hosted', 'saas']).optional(),
  PORT: numericString,
  WEB_ORIGIN: optionalNonEmpty,
  DATABASE_URL: optionalNonEmpty,
  PGLITE_DIR: optionalNonEmpty,
  ADMIN_TOKEN: optionalNonEmpty,
  DESK_KEY_PEPPER: optionalNonEmpty,
  FREE_PLAN_FILE_CAP: numericString,
  MAX_FILE_BYTES: numericString,
  DESK_STORAGE_DRIVER: z.enum(['postgres', 's3']).optional(),
  S3_BUCKET: optionalNonEmpty,
  S3_REGION: optionalNonEmpty,
  S3_ENDPOINT: optionalNonEmpty,
  S3_ACCESS_KEY_ID: optionalNonEmpty,
  S3_SECRET_ACCESS_KEY: optionalNonEmpty,
  S3_PUBLIC_BASE_URL: optionalNonEmpty,
})

export type Env = z.infer<typeof envSchema>

type Warn = (message: string) => void

/**
 * 환경 변수를 검증하고 문제를 경고로만 보고합니다. 절대 throw 하지 않습니다.
 * @param env  검사 대상(기본: process.env)
 * @param warn 경고 싱크(기본: console.warn)
 */
export function validateEnv(
  env: NodeJS.ProcessEnv = process.env,
  warn: Warn = (m) => console.warn(m)
): void {
  const result = envSchema.safeParse(env)

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    warn(`[env] 환경 변수 검증 경고 (계속 진행):\n${issues}`)
  }

  // S3 드라이버를 선택했는데 필수 자격증명이 비어 있으면 경고(스토리지가 거부됨).
  if (env.DESK_STORAGE_DRIVER === 's3') {
    const missing = ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'].filter(
      (k) => !env[k]?.trim()
    )
    if (missing.length > 0) {
      warn(
        `[env] 스토리지 경고: DESK_STORAGE_DRIVER=s3 인데 ${missing.join(', ')} 가 비어 있습니다. ` +
          'S3 어댑터는 자격증명이 모두 설정되어야 동작합니다(미설정 시 업로드가 거부됩니다).'
      )
    }
  }

  // 운영에서 개발 전용 기본값을 그대로 쓰면 보안상 위험 — 큰 경고.
  if (env.NODE_ENV === 'production') {
    for (const [key, unsafe] of Object.entries(UNSAFE_PROD_DEFAULTS)) {
      const value = env[key]?.trim()
      if (!value || unsafe.includes(value)) {
        warn(
          `[env] 보안 경고: 운영(NODE_ENV=production)에서 ${key} 가 미설정/개발 기본값입니다. ` +
            '즉시 강한 무작위 값으로 교체하세요.'
        )
      }
    }
  }
}
