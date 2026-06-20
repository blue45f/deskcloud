import { PUBLISHABLE_KEY_PREFIX, SECRET_KEY_PREFIX } from '@reviewdesk/shared'
import { describe, expect, it } from 'vitest'

import {
  generatePublishableKey,
  generateSecretKey,
  hashSecretKey,
  verifySecretKey,
} from './keys'

describe('keys', () => {
  it('publishable 키는 pk_ 접두사로 발급', () => {
    const pk = generatePublishableKey()
    expect(pk.startsWith(PUBLISHABLE_KEY_PREFIX)).toBe(true)
    expect(pk.length).toBeGreaterThan(PUBLISHABLE_KEY_PREFIX.length + 10)
  })

  it('secret 키는 sk_ 접두사로 발급', () => {
    const sk = generateSecretKey()
    expect(sk.startsWith(SECRET_KEY_PREFIX)).toBe(true)
  })

  it('매번 서로 다른 키를 발급(충돌 없음)', () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateSecretKey()))
    expect(keys.size).toBe(100)
  })

  it('hashSecretKey 는 결정적 SHA-256 hex(64자), 평문과 다름', () => {
    const sk = 'sk_example'
    const h1 = hashSecretKey(sk)
    const h2 = hashSecretKey(sk)
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
    expect(h1).not.toBe(sk)
  })

  it('verifySecretKey 는 일치 시 true, 불일치 시 false', () => {
    const sk = generateSecretKey()
    const hash = hashSecretKey(sk)
    expect(verifySecretKey(sk, hash)).toBe(true)
    expect(verifySecretKey('sk_wrong', hash)).toBe(false)
  })

  it('verifySecretKey 는 형식이 깨진 해시에도 throw 하지 않고 false', () => {
    expect(verifySecretKey('sk_x', 'not-a-hash')).toBe(false)
  })
})
