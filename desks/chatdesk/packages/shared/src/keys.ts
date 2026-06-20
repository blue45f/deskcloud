import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import {
  MEMBER_TOKEN_PREFIX,
  PUBLISHABLE_KEY_BYTES,
  PUBLISHABLE_KEY_PREFIX,
  SECRET_KEY_BYTES,
  SECRET_KEY_PREFIX,
} from './constants'

/**
 * 키 생성·접두·해시 헬퍼. api(가입/회전/검증)·web·sdk 가 공유한다.
 * pk(publishable) 는 평문으로 노출(브라우저), sk(secret) 는 sha-256 해시로만 저장한다.
 */

/** publishable 키 생성 — `pk_` + 32 hex. */
export function generatePublishableKey(): string {
  return PUBLISHABLE_KEY_PREFIX + randomBytes(PUBLISHABLE_KEY_BYTES).toString('hex')
}

/** secret 키 생성 — `sk_` + 48 hex. 평문은 발급 응답에서 1회만 노출. */
export function generateSecretKey(): string {
  return SECRET_KEY_PREFIX + randomBytes(SECRET_KEY_BYTES).toString('hex')
}

/** sk 평문을 DB 저장용 sha-256 해시(hex)로. */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

/** 입력 sk 가 저장된 해시와 일치하는지(상수시간 비교). */
export function verifySecret(secret: string, hash: string): boolean {
  const a = Buffer.from(hashSecret(secret), 'hex')
  const b = Buffer.from(hash, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** 문자열이 publishable 키 형태인지(`pk_` 접두). */
export function isPublishableKey(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.startsWith(PUBLISHABLE_KEY_PREFIX)
}

/** 문자열이 secret 키 형태인지(`sk_` 접두). */
export function isSecretKey(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.startsWith(SECRET_KEY_PREFIX)
}

/** 새 키 한 쌍(pk 평문 · sk 평문 · sk 해시)을 한 번에. 가입/회전 공통. */
export interface KeyPair {
  publishableKey: string
  secretKey: string
  secretKeyHash: string
}

export function generateKeyPair(): KeyPair {
  const secretKey = generateSecretKey()
  return {
    publishableKey: generatePublishableKey(),
    secretKey,
    secretKeyHash: hashSecret(secretKey),
  }
}

// ── 멤버 토큰(선택, 강화 인증) ───────────────────────────────────────────────
// 호스트 서버가 sk 로 멤버 토큰을 발급한다(`mt_` + base64url(payload).hmac).
// 검증 키는 명시 시크릿(MEMBER_TOKEN_SECRET) 또는 sk 해시에서 파생.

const b64url = (buf: Buffer): string => buf.toString('base64url')

/** 멤버 토큰 페이로드 — 어떤 테넌트의 어떤 멤버인지 + 만료(epoch sec). */
export interface MemberTokenPayload {
  /** 테넌트 publishable 키(클라이언트가 같은 테넌트로 연결하는지 교차 확인). */
  pk: string
  /** 멤버 식별자. */
  sub: string
  /** 만료(unix epoch seconds). */
  exp: number
}

/** 멤버 토큰 서명(HMAC-SHA256). 페이로드를 base64url 로 직렬화한 뒤 서명한다. */
export function signMemberToken(payload: MemberTokenPayload, signingKey: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = b64url(createHmac('sha256', signingKey).update(body).digest())
  return `${MEMBER_TOKEN_PREFIX}${body}.${sig}`
}

/** 멤버 토큰 검증 — 서명·만료 확인 후 페이로드 반환(실패 시 null). */
export function verifyMemberToken(
  token: string | undefined | null,
  signingKey: string,
  nowSec: number = Math.floor(Date.now() / 1000)
): MemberTokenPayload | null {
  if (typeof token !== 'string' || !token.startsWith(MEMBER_TOKEN_PREFIX)) return null
  const rest = token.slice(MEMBER_TOKEN_PREFIX.length)
  const dot = rest.indexOf('.')
  if (dot <= 0) return null
  const body = rest.slice(0, dot)
  const sig = rest.slice(dot + 1)
  const expected = b64url(createHmac('sha256', signingKey).update(body).digest())
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  let payload: MemberTokenPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as MemberTokenPayload
  } catch {
    return null
  }
  if (typeof payload.exp !== 'number' || payload.exp < nowSec) return null
  if (typeof payload.sub !== 'string' || typeof payload.pk !== 'string') return null
  return payload
}

/** sk(없으면 폴백) 에서 멤버 토큰 서명 키를 파생한다. 명시 시크릿이 있으면 그것을 우선. */
export function deriveMemberTokenKey(
  secretKeyOrHash: string,
  explicitSecret?: string | null
): string {
  if (explicitSecret && explicitSecret.trim()) return explicitSecret.trim()
  return hashSecret(`member-token:${secretKeyOrHash}`)
}
