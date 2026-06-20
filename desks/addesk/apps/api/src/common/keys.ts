import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import { PUBLISHABLE_KEY_PREFIX, SECRET_KEY_PREFIX } from '@addesk/shared'

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

/**
 * secret 키 → SHA-256 hex 해시(DB 저장·조회 비교용).
 * 서버 페퍼(pepper)를 섞어 해시한다 — DB 가 유출돼도 페퍼 없이는 후보 키 대입(레인보우/역산)을
 * 어렵게 한다. 페퍼는 환경 변수(KEY_PEPPER)로 주입한다.
 */
export function hashSecretKey(secretKey: string, pepper = ''): string {
  return createHash('sha256').update(`${pepper}:${secretKey}`, 'utf8').digest('hex')
}

/**
 * 후보 secret 키가 저장된 해시와 일치하는지 — 타이밍 세이프 비교.
 * (해시 길이가 고정이라 길이 누설 위험은 없지만, 일관성을 위해 timingSafeEqual 사용.)
 */
export function verifySecretKey(candidate: string, storedHash: string, pepper = ''): boolean {
  const candidateHash = hashSecretKey(candidate, pepper)
  const a = Buffer.from(candidateHash, 'hex')
  const b = Buffer.from(storedHash, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * 두 비밀 문자열의 타이밍 세이프 동등 비교(글로벌 어드민 토큰 등 가변 길이 비밀용).
 * 길이가 다르면 즉시 false 지만, 같은 길이끼리는 SHA-256 다이제스트를 timingSafeEqual 로 비교해
 * 바이트별 조기 종료(early-exit) 사이드채널을 없앤다 — 평문 `===` 대비 가장 권한 높은 자격증명 보호.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  // 다이제스트로 비교해 입력 내용과 무관하게 고정 길이(32바이트) 비교가 되도록 한다.
  const da = createHash('sha256').update(a, 'utf8').digest()
  const db = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(da, db)
}
