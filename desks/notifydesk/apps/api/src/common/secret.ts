import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * secret 키 해싱 — 저장은 항상 해시. 평문은 가입/rotate 응답에서 한 번만 노출.
 *
 * scrypt(salt 내장) 로 해시한다. 형식: `scrypt$<saltHex>$<hashHex>`.
 * 검증은 timingSafeEqual 로 타이밍 누설을 막는다.
 */
const SCRYPT_KEYLEN = 32

export function hashSecret(secret: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(secret, salt, SCRYPT_KEYLEN)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export function verifySecret(secret: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1]!, 'hex')
  const expected = Buffer.from(parts[2]!, 'hex')
  const derived = scryptSync(secret, salt, expected.length)
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

/**
 * 빠른 조회용 결정적 룩업 해시 — secret 키로 테넌트를 찾기 위한 인덱스 컬럼.
 * scrypt 해시는 salt 가 매번 달라 WHERE 조회가 불가하므로, 별도의 SHA-256(고정) 룩업
 * 해시를 둔다. 인증의 최종 판단은 scrypt verifySecret 으로 한다(룩업은 후보 선택만).
 */
export function lookupHash(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}
