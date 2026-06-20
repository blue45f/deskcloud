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
  AUTHDESK_KEY_PEPPER: ['dev-pepper-change-me', 'change-me', 'pepper'],
  AUTHDESK_JWT_SECRET: ['dev-jwt-secret-change-me', 'change-me', 'secret'],
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
  AUTHDESK_MODE: z.enum(['self-hosted', 'saas']).optional(),
  PORT: numericString,
  WEB_ORIGIN: optionalNonEmpty,
  DATABASE_URL: optionalNonEmpty,
  PGLITE_DIR: optionalNonEmpty,
  AUTHDESK_KEY_PEPPER: optionalNonEmpty,
  AUTHDESK_JWT_SECRET: optionalNonEmpty,
  AUTHDESK_ACCESS_TTL: numericString,
  ADMIN_TOKEN: optionalNonEmpty,
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
