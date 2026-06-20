import {
  FILE_KEY_LENGTH,
  KEY_BODY_LENGTH,
  PUBLISHABLE_KEY_PREFIX,
  SECRET_KEY_PREFIX,
} from './constants'

/** 키 종류 — publishable(브라우저 노출 OK) · secret(서버 전용). */
export type KeyKind = 'publishable' | 'secret'

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * 무작위 base62 본문 생성. crypto.getRandomValues 가 있으면 사용(브라우저·Node 18+),
 * 없으면 Math.random 폴백(테스트/구형 환경 — 보안 키는 항상 crypto 경로).
 */
export function randomBody(length: number): string {
  const out: string[] = []
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(length)
    cryptoObj.getRandomValues(buf)
    for (let i = 0; i < length; i += 1) out.push(BASE62[buf[i]! % BASE62.length]!)
  } else {
    for (let i = 0; i < length; i += 1) {
      out.push(BASE62[Math.floor(Math.random() * BASE62.length)]!)
    }
  }
  return out.join('')
}

/** 접두사 + 무작위 본문으로 키를 생성한다. */
export function generateKey(kind: KeyKind, length = KEY_BODY_LENGTH): string {
  const prefix = kind === 'publishable' ? PUBLISHABLE_KEY_PREFIX : SECRET_KEY_PREFIX
  return prefix + randomBody(length)
}

/** publishable 키쌍·secret 키쌍을 한 번에 생성. */
export function generateKeyPair(): { publishableKey: string; secretKey: string } {
  return {
    publishableKey: generateKey('publishable'),
    secretKey: generateKey('secret'),
  }
}

/** 파일 객체 key(불투명 식별자) 생성 — 접두사 없는 base62 본문. */
export function generateFileKey(length = FILE_KEY_LENGTH): string {
  return randomBody(length)
}

/** 키 종류 판별(접두사 기준). 알 수 없으면 null. */
export function keyKind(key: string): KeyKind | null {
  if (key.startsWith(PUBLISHABLE_KEY_PREFIX)) return 'publishable'
  if (key.startsWith(SECRET_KEY_PREFIX)) return 'secret'
  return null
}

export const isPublishableKey = (key: string): boolean => keyKind(key) === 'publishable'
export const isSecretKey = (key: string): boolean => keyKind(key) === 'secret'

/** 어드민/UI 표시용 키 마스킹 — 앞 8자만 남기고 나머지는 가린다. */
export function maskKey(key: string): string {
  if (key.length <= 8) return key
  return `${key.slice(0, 8)}…${key.slice(-2)}`
}
