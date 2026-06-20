import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

import { PASSWORD_MAX, PASSWORD_MIN } from './constants'

/**
 * 비밀번호 정책 검증 + end-user 비밀번호 해싱 — 순수 유틸(api·테스트 공유).
 *
 * 정책 검사(validatePassword) 는 길이·문자 다양성·공백만 차단만 본다:
 *  - 길이 PASSWORD_MIN..PASSWORD_MAX
 *  - 최소 2종 이상의 문자 클래스(소문자/대문자/숫자/기호) — 너무 단순한 비밀번호 차단
 *  - 공백만으로 채운 값 거부
 *
 * 실제 해싱은 node:crypto scrypt(KDF) 로 한다 — 네이티브 모듈(argon2)을 피해 Vercel
 * 서버리스 파일 트레이싱에서 안전하고(순수 Node 내장), 의존성 0 으로 형제 앱에 그대로
 * 벤더링된다. 형식: `scrypt$N$<saltHex>$<hashHex>`. 검증은 timingSafeEqual 로 타이밍 누설 차단.
 *
 * 주: 비밀번호 평문을 **로그/예외 메시지/저장 어디에도 남기지 않는다**(해시·검증 결과만).
 */
export interface PasswordPolicyResult {
  ok: boolean
  /** 통과하지 못한 이유(사용자 노출용 — 평문 미포함). */
  reasons: string[]
}

const CLASS_RE: ReadonlyArray<readonly [RegExp, string]> = [
  [/[a-z]/, 'lower'],
  [/[A-Z]/, 'upper'],
  [/[0-9]/, 'digit'],
  [/[^A-Za-z0-9]/, 'symbol'],
]

/** 비밀번호가 포함한 문자 클래스 수(소문자/대문자/숫자/기호). */
export function passwordClassCount(password: string): number {
  return CLASS_RE.reduce((n, [re]) => (re.test(password) ? n + 1 : n), 0)
}

/** 비밀번호 정책 검사. 통과하면 ok:true, 아니면 reasons 에 사유. */
export function validatePassword(password: unknown): PasswordPolicyResult {
  const reasons: string[] = []
  if (typeof password !== 'string') {
    return { ok: false, reasons: ['비밀번호는 문자열이어야 합니다'] }
  }
  if (password.length < PASSWORD_MIN) {
    reasons.push(`비밀번호는 최소 ${PASSWORD_MIN}자 이상이어야 합니다`)
  }
  if (password.length > PASSWORD_MAX) {
    reasons.push(`비밀번호는 최대 ${PASSWORD_MAX}자 이하여야 합니다`)
  }
  if (password.trim().length === 0) {
    reasons.push('비밀번호는 공백만으로 구성할 수 없습니다')
  }
  // 길이 정책을 만족하는 경우에만 다양성까지 따진다(중복 사유 노이즈 방지).
  if (reasons.length === 0 && passwordClassCount(password) < 2) {
    reasons.push('영문 대/소문자·숫자·기호 중 2종류 이상을 포함해야 합니다')
  }
  return { ok: reasons.length === 0, reasons }
}

/** 이메일 정규화 — 소문자 + trim(테넌트별 유니크 비교의 안정적 키). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/* ──────────────────────────────────────────────────────────────────────────
   비밀번호 해싱 — node:crypto scrypt(KDF). 네이티브 의존 0(argon2 회피).
   ────────────────────────────────────────────────────────────────────────── */

/** scrypt 비용 파라미터 N(2^15). 메모리/시간 비용의 기본값 — 단위 테스트도 통과 가능한 균형값. */
const SCRYPT_N = 1 << 15
const SCRYPT_KEYLEN = 32
const SCRYPT_SALT_BYTES = 16
/** scrypt N 을 키울 때 maxmem 기본 한도(32MB)를 넘지 않도록 명시 상향. */
const SCRYPT_MAXMEM = 64 * 1024 * 1024

/**
 * scrypt 의 옵션 인자 오버로드를 Promise 로 감싼 래퍼. `promisify(scrypt)` 는 옵션 없는
 * 오버로드만 잡아 options 인자를 못 받으므로, 콜백 폼을 직접 감싸 options 를 명시 전달한다.
 */
function scryptDerive(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey)
    })
  })
}

/**
 * 비밀번호를 scrypt 로 해시한다. salt 는 매 호출 무작위(16바이트), 결과에 인라인 저장한다.
 * 형식: `scrypt$<N>$<saltHex>$<hashHex>`. 비밀번호 평문은 반환·로그 어디에도 남기지 않는다.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_BYTES)
  const derived = await scryptDerive(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    maxmem: SCRYPT_MAXMEM,
  })
  return `scrypt$${SCRYPT_N}$${salt.toString('hex')}$${derived.toString('hex')}`
}

/**
 * 제시한 비밀번호가 저장된 scrypt 해시와 일치하는지 — 타이밍 안전 비교.
 * 형식이 아니거나 파라미터가 깨졌으면 false(throw 하지 않음).
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false
  const n = Number(parts[1])
  if (!Number.isInteger(n) || n < 2) return false
  const salt = Buffer.from(parts[2]!, 'hex')
  const expected = Buffer.from(parts[3]!, 'hex')
  if (salt.length === 0 || expected.length === 0) return false
  try {
    const derived = await scryptDerive(password, salt, expected.length, {
      N: n,
      maxmem: SCRYPT_MAXMEM,
    })
    if (derived.length !== expected.length) return false
    return timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}
