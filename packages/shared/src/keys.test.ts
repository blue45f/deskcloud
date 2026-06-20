import { describe, expect, it } from 'vitest'

import {
  extractBearerSecretKey,
  extractBearerToken,
  generatePublishableKey,
  generateSecretKey,
  hashSecretKey,
  isPublishableKey,
  isSecretKey,
  verifySecretKey,
} from './keys'

describe('key generation', () => {
  it('publishable 키는 pk_ 프리픽스를 가지며 매번 다르다', () => {
    const a = generatePublishableKey()
    const b = generatePublishableKey()
    expect(a.startsWith('pk_')).toBe(true)
    expect(isPublishableKey(a)).toBe(true)
    expect(a).not.toBe(b)
  })

  it('secret 키는 sk_ 프리픽스를 가진다', () => {
    const k = generateSecretKey()
    expect(k.startsWith('sk_')).toBe(true)
    expect(isSecretKey(k)).toBe(true)
    expect(isPublishableKey(k)).toBe(false)
  })
})

describe('secret key hashing', () => {
  it('pepper 가 다르면 해시가 다르다', () => {
    const key = generateSecretKey()
    expect(hashSecretKey(key, 'p1')).not.toBe(hashSecretKey(key, 'p2'))
  })

  it('verifySecretKey 는 올바른 키+pepper 에만 true', () => {
    const key = generateSecretKey()
    const pepper = 'server-pepper'
    const stored = hashSecretKey(key, pepper)
    expect(verifySecretKey(key, stored, pepper)).toBe(true)
    expect(verifySecretKey(key, stored, 'wrong-pepper')).toBe(false)
    expect(verifySecretKey(generateSecretKey(), stored, pepper)).toBe(false)
  })

  it('길이가 다른 해시 비교는 안전하게 false', () => {
    expect(verifySecretKey('sk_x', 'short', 'p')).toBe(false)
  })
})

describe('bearer extraction', () => {
  it('Bearer sk_… 에서 secret 키를 추출한다', () => {
    const key = generateSecretKey()
    expect(extractBearerSecretKey(`Bearer ${key}`)).toBe(key)
    expect(extractBearerSecretKey(`bearer ${key}`)).toBe(key)
  })

  it('secret 키가 아니면 null', () => {
    expect(extractBearerSecretKey('Bearer not-a-key')).toBeNull()
    expect(extractBearerSecretKey('Bearer pk_public')).toBeNull()
    expect(extractBearerSecretKey(undefined)).toBeNull()
  })

  it('extractBearerToken 은 임의 토큰(JWT 등)을 추출한다', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi')
    expect(extractBearerToken('Basic xyz')).toBeNull()
    expect(extractBearerToken(null)).toBeNull()
  })
})
