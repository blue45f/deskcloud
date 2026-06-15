import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import {
  KEY_RANDOM_BYTES,
  PUBLISHABLE_KEY_PREFIX,
  SECRET_KEY_PREFIX,
} from './constants'

/**
 * API 키 생성·해시·검증 — 순수 유틸(프레임워크 무관). core 의 ApiKeyService 가 래핑한다.
 *
 * - publishable 키(`pk_…`): 공개 안전(프론트 임베드). 평문 그대로 저장·노출.
 * - secret 키(`sk_…`): 서버 전용. SHA-256(키 + pepper) **해시만** 저장. 평문은 발급/회전 시 1회만.
 */

/** prefix + base64url(랜덤 24바이트) 형태의 키 문자열을 만든다. */
function makeKey(prefix: string): string {
  return prefix + randomBytes(KEY_RANDOM_BYTES).toString('base64url')
}

/** publishable 키(`pk_…`) 생성 — 공개 안전. */
export function generatePublishableKey(): string {
  return makeKey(PUBLISHABLE_KEY_PREFIX)
}

/** secret 키(`sk_…`) 생성 — 평문은 호출자에게만, 저장은 해시로. */
export function generateSecretKey(): string {
  return makeKey(SECRET_KEY_PREFIX)
}

/**
 * secret 키 해시. SHA-256(secretKey + pepper) 16진 문자열.
 * pepper 는 서버 비밀(DESK_KEY_PEPPER) — DB 유출 시 키 역산을 어렵게 한다.
 */
export function hashSecretKey(secretKey: string, pepper = ''): string {
  return createHash('sha256').update(secretKey + pepper).digest('hex')
}

/**
 * 제시된 secret 키가 저장된 해시와 일치하는지 — 타이밍 안전 비교.
 * 길이가 다르면 즉시 false(timingSafeEqual 은 길이 동일 요구).
 */
export function verifySecretKey(secretKey: string, storedHash: string, pepper = ''): boolean {
  const candidate = hashSecretKey(secretKey, pepper)
  const a = Buffer.from(candidate, 'utf8')
  const b = Buffer.from(storedHash, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** publishable 키 형태 검사(`pk_` 프리픽스 + 비어있지 않은 본문). */
export function isPublishableKey(key: string): boolean {
  return key.startsWith(PUBLISHABLE_KEY_PREFIX) && key.length > PUBLISHABLE_KEY_PREFIX.length
}

/** secret 키 형태 검사(`sk_` 프리픽스 + 비어있지 않은 본문). */
export function isSecretKey(key: string): boolean {
  return key.startsWith(SECRET_KEY_PREFIX) && key.length > SECRET_KEY_PREFIX.length
}

/**
 * `Authorization: Bearer sk_…` 헤더에서 secret 키를 추출한다. 형식이 아니면 null.
 * (core 의 SecretKeyGuard 와 임의 호출자가 공유.)
 */
export function extractBearerKey(authHeader: string | undefined | null): string | null {
  if (!authHeader) return null
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim())
  const token = m?.[1]?.trim()
  return token && isSecretKey(token) ? token : null
}
