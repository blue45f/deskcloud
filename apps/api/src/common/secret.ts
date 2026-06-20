import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * secret 키 해싱 — 저장은 항상 해시. 평문은 가입/rotate 응답에서 한 번만 노출.
 *
 * scrypt(salt 내장) 로 해시한다. 형식: `scrypt$<saltHex>$<hashHex>`.
 * 앱 전역 페퍼(DESK_KEY_PEPPER)를 키에 섞어 DB 유출 시에도 오프라인 대입을 어렵게 한다.
 * 검증은 timingSafeEqual 로 타이밍 누설을 막는다.
 */
const SCRYPT_KEYLEN = 32

/** secret + pepper 를 결합한 입력(해시/룩업 공통). */
function peppered(secret: string, pepper: string): string {
  return `${secret}:${pepper}`
}

export function hashSecret(secret: string, pepper: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(peppered(secret, pepper), salt, SCRYPT_KEYLEN)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export function verifySecret(secret: string, stored: string, pepper: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1]!, 'hex')
  const expected = Buffer.from(parts[2]!, 'hex')
  const derived = scryptSync(peppered(secret, pepper), salt, expected.length)
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

/**
 * 빠른 조회용 결정적 룩업 해시 — secret 키로 테넌트를 찾기 위한 인덱스 컬럼.
 * scrypt 해시는 salt 가 매번 달라 WHERE 조회가 불가하므로, 별도의 SHA-256(고정·peppered)
 * 룩업 해시를 둔다. 인증의 최종 판단은 scrypt verifySecret 으로 한다(룩업은 후보 선택만).
 */
export function lookupHash(secret: string, pepper: string): string {
  return createHash('sha256').update(peppered(secret, pepper)).digest('hex')
}

/**
 * 방문자 해시 — 익명 방문 집계용 SHA-256(pepper + clientId). 원본 clientId/IP/PII 는 저장하지 않는다.
 * (day, visitorHash) 로 '고유 브라우저/일' 만 중복 제거하므로 개인을 식별·추적할 수 없다.
 */
export function visitorHash(clientId: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}:visit:${clientId}`).digest('hex')
}

/**
 * private 파일 서명 토큰 — HMAC-SHA256(pepper) 기반. 형식: `<expEpochSec>.<sigHex>`.
 * fileId 와 만료를 묶어 서명하므로 다른 파일/만료로 재사용할 수 없다. 상태 비저장(검증만).
 */
export function signFileToken(fileId: string, expiresAtSec: number, pepper: string): string {
  const sig = createHmac('sha256', pepper).update(`${fileId}.${expiresAtSec}`).digest('hex')
  return `${expiresAtSec}.${sig}`
}

/** 서명 토큰 검증 — 만료 + HMAC 일치(타이밍 안전). 유효하면 true. */
export function verifyFileToken(
  fileId: string,
  token: string,
  pepper: string,
  now: number = Date.now()
): boolean {
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const expStr = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!/^\d+$/.test(expStr) || !sig) return false
  const expSec = Number(expStr)
  if (!Number.isFinite(expSec) || expSec * 1000 < now) return false
  const expected = createHmac('sha256', pepper).update(`${fileId}.${expSec}`).digest('hex')
  const a = Buffer.from(sig, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
