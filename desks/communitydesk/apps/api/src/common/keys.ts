import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import { PUBLISHABLE_KEY_PREFIX, SECRET_KEY_PREFIX } from '@communitydesk/shared'

/** 키 본체 바이트 수(랜덤). base64url 로 인코딩해 접두사를 붙인다. */
const KEY_BYTES = 24

function randomToken(prefix: string): string {
  // base64url(슬래시/플러스/패딩 없음) — URL·헤더 안전.
  const raw = randomBytes(KEY_BYTES).toString('base64url')
  return `${prefix}${raw}`
}

/** publishable 키 발급 — 브라우저 노출 가능(pk_...). */
export function generatePublishableKey(): string {
  return randomToken(PUBLISHABLE_KEY_PREFIX)
}

/** secret 키 발급 — 서버 전용(sk_...). 평문은 발급 시 1회만, DB 에는 해시만 저장. */
export function generateSecretKey(): string {
  return randomToken(SECRET_KEY_PREFIX)
}

/** secret 키 → SHA-256 hex 해시(DB 저장·조회 비교용). */
export function hashSecretKey(secretKey: string): string {
  return createHash('sha256').update(secretKey, 'utf8').digest('hex')
}

/**
 * 후보 secret 키가 저장된 해시와 일치하는지 — 타이밍 세이프 비교.
 * (해시 길이가 고정이라 길이 누설 위험은 없지만, 일관성을 위해 timingSafeEqual 사용.)
 */
export function verifySecretKey(candidate: string, storedHash: string): boolean {
  const candidateHash = hashSecretKey(candidate)
  const a = Buffer.from(candidateHash, 'hex')
  const b = Buffer.from(storedHash, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
