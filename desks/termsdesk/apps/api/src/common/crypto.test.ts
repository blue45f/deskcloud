import { describe, expect, it } from 'vitest'

import { generateApiKey, hashApiKey, hashPassword, verifyPassword } from './crypto'

describe('password hashing (scrypt)', () => {
  it('맞는 비밀번호는 통과, 틀리면 거부', () => {
    const stored = hashPassword('s3cret-pw')
    expect(stored.startsWith('scrypt$')).toBe(true)
    expect(verifyPassword('s3cret-pw', stored)).toBe(true)
    expect(verifyPassword('wrong', stored)).toBe(false)
  })

  it('손상된 저장값은 거부', () => {
    expect(verifyPassword('x', 'not-a-hash')).toBe(false)
  })
})

describe('API 키', () => {
  it('tdk_ 접두사 + prefix/hash 일관', () => {
    const { full, prefix, hash } = generateApiKey()
    expect(full.startsWith('tdk_')).toBe(true)
    expect(prefix).toBe(full.slice(0, 11))
    expect(hashApiKey(full)).toBe(hash)
  })
})
