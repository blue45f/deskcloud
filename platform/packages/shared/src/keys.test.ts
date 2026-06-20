import { describe, expect, it } from 'vitest'

import {
  extractBearerKey,
  generatePublishableKey,
  generateSecretKey,
  hashSecretKey,
  isPublishableKey,
  isSecretKey,
  verifySecretKey,
} from './keys'

describe('keys', () => {
  it('publishable 키는 pk_ 프리픽스 + 충분한 본문', () => {
    const k = generatePublishableKey()
    expect(k.startsWith('pk_')).toBe(true)
    expect(isPublishableKey(k)).toBe(true)
    expect(isSecretKey(k)).toBe(false)
    expect(k.length).toBeGreaterThan('pk_'.length + 20)
  })

  it('secret 키는 sk_ 프리픽스 + 충분한 본문, 매번 다름', () => {
    const a = generateSecretKey()
    const b = generateSecretKey()
    expect(a.startsWith('sk_')).toBe(true)
    expect(isSecretKey(a)).toBe(true)
    expect(isPublishableKey(a)).toBe(false)
    expect(a).not.toBe(b)
  })

  it('해시는 결정적이고 pepper 에 따라 달라진다', () => {
    const k = generateSecretKey()
    expect(hashSecretKey(k, 'p')).toBe(hashSecretKey(k, 'p'))
    expect(hashSecretKey(k, 'p')).not.toBe(hashSecretKey(k, 'q'))
    expect(hashSecretKey(k)).not.toBe(hashSecretKey(k, 'p'))
  })

  it('verifySecretKey: 올바른 키/pepper 만 통과', () => {
    const k = generateSecretKey()
    const stored = hashSecretKey(k, 'pepper')
    expect(verifySecretKey(k, stored, 'pepper')).toBe(true)
    expect(verifySecretKey(k, stored, 'wrong')).toBe(false)
    expect(verifySecretKey(generateSecretKey(), stored, 'pepper')).toBe(false)
  })

  it('verifySecretKey: 길이 다른 저장값에도 안전(throw 없음)', () => {
    const k = generateSecretKey()
    expect(verifySecretKey(k, 'short', '')).toBe(false)
  })

  it('extractBearerKey: Bearer sk_… 만 추출', () => {
    const k = generateSecretKey()
    expect(extractBearerKey(`Bearer ${k}`)).toBe(k)
    expect(extractBearerKey(`bearer ${k}`)).toBe(k)
    expect(extractBearerKey(k)).toBeNull() // Bearer 없음
    expect(extractBearerKey('Bearer pk_publishable')).toBeNull() // secret 아님
    expect(extractBearerKey(undefined)).toBeNull()
    expect(extractBearerKey('')).toBeNull()
  })
})
