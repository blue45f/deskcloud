import { createHash, randomBytes } from 'node:crypto'

import {
  KEY_RANDOM_LEN,
  bytesToBase62,
  formatPublishableKey,
  formatSecretKey,
} from '@mediadesk/shared'

/** crypto 무작위 바이트로 publishable 키(pk_…) 생성. */
export function generatePublishableKey(): string {
  return formatPublishableKey(bytesToBase62(randomBytes(KEY_RANDOM_LEN)))
}

/** crypto 무작위 바이트로 secret 키(sk_…) 생성(평문 — 호출부가 해시 후 폐기). */
export function generateSecretKey(): string {
  return formatSecretKey(bytesToBase62(randomBytes(KEY_RANDOM_LEN)))
}

/** secret 키 → 저장용 sha-256 해시(hex). 평문은 절대 저장하지 않는다. */
export function hashSecretKey(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

/** 무작위 키 충돌 회피용 짧은 세그먼트(자산 키 random). */
export function shortRandom(len = 8): string {
  return bytesToBase62(randomBytes(len)).slice(0, len)
}
