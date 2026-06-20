import { describe, expect, it } from 'vitest'

import { KEY_BODY_LENGTH, PUBLISHABLE_KEY_PREFIX, SECRET_KEY_PREFIX } from './constants'
import { generateKey, generateKeyPair, isPublishableKey, isSecretKey, keyKind, maskKey } from './keys'

describe('keys', () => {
  it('generateKey 가 올바른 접두사·길이로 생성한다', () => {
    const pk = generateKey('publishable')
    const sk = generateKey('secret')
    expect(pk.startsWith(PUBLISHABLE_KEY_PREFIX)).toBe(true)
    expect(sk.startsWith(SECRET_KEY_PREFIX)).toBe(true)
    expect(pk).toHaveLength(PUBLISHABLE_KEY_PREFIX.length + KEY_BODY_LENGTH)
    expect(sk).toHaveLength(SECRET_KEY_PREFIX.length + KEY_BODY_LENGTH)
  })

  it('generateKeyPair 가 서로 다른 두 키를 만든다', () => {
    const { publishableKey, secretKey } = generateKeyPair()
    expect(isPublishableKey(publishableKey)).toBe(true)
    expect(isSecretKey(secretKey)).toBe(true)
    expect(publishableKey).not.toBe(secretKey)
  })

  it('연속 생성 키가 충돌하지 않는다', () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateKey('secret')))
    expect(keys.size).toBe(200)
  })

  it('keyKind 가 접두사로 종류를 판별한다', () => {
    expect(keyKind('pk_abc')).toBe('publishable')
    expect(keyKind('sk_abc')).toBe('secret')
    expect(keyKind('nope')).toBeNull()
  })

  it('maskKey 가 앞 8자만 노출한다', () => {
    const masked = maskKey('sk_1234567890abcdef')
    expect(masked.startsWith('sk_12345')).toBe(true)
    expect(masked).toContain('…')
    expect(maskKey('short')).toBe('short')
  })
})
