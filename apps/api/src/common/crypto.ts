import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'

/** scrypt 기반 비밀번호 해시 (네이티브 bcrypt 빌드 회피). 형식: scrypt$salt$hash */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  const [scheme, salt, hash] = parts
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

/** API 키 생성. 평문(full)은 1회만 노출, 저장은 sha256 해시만. */
export function generateApiKey(): { full: string; prefix: string; hash: string } {
  const raw = randomBytes(24).toString('base64url')
  const full = `tdk_${raw}`
  return { full, prefix: full.slice(0, 11), hash: hashApiKey(full) }
}

export function hashApiKey(full: string): string {
  return createHash('sha256').update(full).digest('hex')
}

export { randomUUID }
