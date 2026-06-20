import {
  KEY_BODY_LENGTH,
  PUBLISHABLE_KEY_PREFIX,
  SECRET_KEY_PREFIX,
  SLUG_RE,
} from './constants'

/**
 * 키 발급·해시는 Node 의 `node:crypto` 를 쓴다(서버 전용). 단, 이 모듈은 브라우저
 * 번들(@changelogdesk/widget·web)에도 배럴(index.ts)을 통해 끌려오므로, `node:crypto`
 * 를 **톱레벨에서 import 하지 않고** 호출 시점에 지연 로딩한다. 키 함수는 브라우저에서
 * 호출되지 않으므로(읽기 전용 pk 만 사용), 모듈 로드는 브라우저에서도 안전하다.
 */
type NodeCrypto = typeof import('node:crypto')
let cryptoMod: NodeCrypto | null = null
function nodeCrypto(): NodeCrypto {
  if (cryptoMod) return cryptoMod
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- 지연 로딩(브라우저 번들 보호)
  cryptoMod = require('node:crypto') as NodeCrypto
  return cryptoMod
}

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * 무작위 base62 본문 문자열(편향 없는 거부 샘플링).
 * 256 % 62 != 0 이라 단순 모듈로는 약간 편향되므로 248(=62*4) 이상 바이트는 버린다.
 */
function randomBase62(length: number): string {
  const { randomBytes } = nodeCrypto()
  let out = ''
  while (out.length < length) {
    const buf = randomBytes(length)
    for (let i = 0; i < buf.length && out.length < length; i += 1) {
      const b = buf[i]!
      if (b >= 248) continue
      out += BASE62[b % 62]
    }
  }
  return out
}

/** 퍼블리시 키(pk_…) — 브라우저 노출 안전. 평문으로 저장·조회한다. */
export function generatePublishableKey(): string {
  return PUBLISHABLE_KEY_PREFIX + randomBase62(KEY_BODY_LENGTH)
}

/** 시크릿 키(sk_…) — 서버/어드민 전용. 평문은 발급 1회만, 저장은 해시. */
export function generateSecretKey(): string {
  return SECRET_KEY_PREFIX + randomBase62(KEY_BODY_LENGTH)
}

/** 시크릿 키 해시(SHA-256 hex) — DB 에는 이 값만 저장한다. */
export function hashSecretKey(secretKey: string): string {
  return nodeCrypto().createHash('sha256').update(secretKey, 'utf8').digest('hex')
}

/** 입력 시크릿 키가 저장된 해시와 일치하는지(상수 시간 비교). */
export function verifySecretKey(candidate: string, storedHash: string): boolean {
  if (!candidate || !storedHash) return false
  const a = Buffer.from(hashSecretKey(candidate), 'hex')
  const b = Buffer.from(storedHash, 'hex')
  if (a.length !== b.length) return false
  return nodeCrypto().timingSafeEqual(a, b)
}

/** pk_ 프리픽스 형태 확인(존재 여부는 별도 조회). */
export function isPublishableKey(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.startsWith(PUBLISHABLE_KEY_PREFIX) && value.length > PUBLISHABLE_KEY_PREFIX.length
}

/** sk_ 프리픽스 형태 확인. */
export function isSecretKey(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.startsWith(SECRET_KEY_PREFIX) && value.length > SECRET_KEY_PREFIX.length
}

/**
 * name 에서 안정적 slug 파생 — 소문자·공백→하이픈·허용문자만. 비면 'tenant'.
 * 유니크 보장은 호출측(서버)이 충돌 시 접미사로 처리.
 */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
  return SLUG_RE.test(base) ? base : 'tenant'
}
