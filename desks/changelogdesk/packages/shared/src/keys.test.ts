import { describe, expect, it } from 'vitest'

import { KEY_BODY_LENGTH, PUBLISHABLE_KEY_PREFIX, SECRET_KEY_PREFIX } from './constants'
import {
  generatePublishableKey,
  generateSecretKey,
  hashSecretKey,
  isPublishableKey,
  isSecretKey,
  slugify,
  verifySecretKey,
} from './keys'

describe('key issuance', () => {
  it('퍼블리시 키는 pk_ 프리픽스 + 본문 길이', () => {
    const pk = generatePublishableKey()
    expect(pk.startsWith(PUBLISHABLE_KEY_PREFIX)).toBe(true)
    expect(pk.length).toBe(PUBLISHABLE_KEY_PREFIX.length + KEY_BODY_LENGTH)
    expect(isPublishableKey(pk)).toBe(true)
    expect(isSecretKey(pk)).toBe(false)
  })

  it('시크릿 키는 sk_ 프리픽스 + 본문 길이', () => {
    const sk = generateSecretKey()
    expect(sk.startsWith(SECRET_KEY_PREFIX)).toBe(true)
    expect(sk.length).toBe(SECRET_KEY_PREFIX.length + KEY_BODY_LENGTH)
    expect(isSecretKey(sk)).toBe(true)
    expect(isPublishableKey(sk)).toBe(false)
  })

  it('키는 매번 달라야 한다(충돌 없음)', () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateSecretKey()))
    expect(keys.size).toBe(200)
  })

  it('본문은 base62 문자만 포함', () => {
    const body = generatePublishableKey().slice(PUBLISHABLE_KEY_PREFIX.length)
    expect(/^[A-Za-z0-9]+$/.test(body)).toBe(true)
  })
})

describe('secret key hashing', () => {
  it('해시는 결정적이고 평문과 다르다', () => {
    const sk = generateSecretKey()
    const h1 = hashSecretKey(sk)
    const h2 = hashSecretKey(sk)
    expect(h1).toBe(h2)
    expect(h1).not.toBe(sk)
    expect(h1).toHaveLength(64) // sha256 hex
  })

  it('verify 는 올바른 키만 통과', () => {
    const sk = generateSecretKey()
    const hash = hashSecretKey(sk)
    expect(verifySecretKey(sk, hash)).toBe(true)
    expect(verifySecretKey(generateSecretKey(), hash)).toBe(false)
    expect(verifySecretKey('', hash)).toBe(false)
    expect(verifySecretKey(sk, '')).toBe(false)
  })
})

describe('slugify', () => {
  it('이름을 slug 로 정규화', () => {
    expect(slugify('Acme Corp')).toBe('acme-corp')
    expect(slugify('  Hello   World  ')).toBe('hello-world')
    expect(slugify('My_App v2')).toBe('my-app-v2')
  })

  it('허용 불가 입력은 폴백', () => {
    expect(slugify('!!!')).toBe('tenant')
    expect(slugify('')).toBe('tenant')
  })
})
