import { describe, expect, it } from 'vitest'

import {
  deriveMemberTokenKey,
  generateKeyPair,
  generatePublishableKey,
  generateSecretKey,
  hashSecret,
  isPublishableKey,
  isSecretKey,
  signMemberToken,
  verifyMemberToken,
  verifySecret,
} from './keys'

describe('keys', () => {
  it('pk 는 pk_ 접두 + 32 hex, sk 는 sk_ 접두 + 48 hex', () => {
    const pk = generatePublishableKey()
    const sk = generateSecretKey()
    expect(pk).toMatch(/^pk_[0-9a-f]{32}$/)
    expect(sk).toMatch(/^sk_[0-9a-f]{48}$/)
    expect(isPublishableKey(pk)).toBe(true)
    expect(isSecretKey(sk)).toBe(true)
    expect(isPublishableKey(sk)).toBe(false)
    expect(isSecretKey(pk)).toBe(false)
    expect(isPublishableKey(undefined)).toBe(false)
  })

  it('sk 해시는 sha-256 hex, 상수시간 검증 통과/실패', () => {
    const sk = generateSecretKey()
    const hash = hashSecret(sk)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(verifySecret(sk, hash)).toBe(true)
    expect(verifySecret('sk_wrong', hash)).toBe(false)
  })

  it('generateKeyPair 는 pk·sk·해시가 정합', () => {
    const pair = generateKeyPair()
    expect(isPublishableKey(pair.publishableKey)).toBe(true)
    expect(isSecretKey(pair.secretKey)).toBe(true)
    expect(pair.secretKeyHash).toBe(hashSecret(pair.secretKey))
    expect(verifySecret(pair.secretKey, pair.secretKeyHash)).toBe(true)
  })
})

describe('member token', () => {
  const key = deriveMemberTokenKey(hashSecret('sk_demo'))

  it('발급·검증 라운드트립(서명·만료·sub·pk)', () => {
    const now = 1_000_000
    const token = signMemberToken({ pk: 'pk_demo', sub: 'alice', exp: now + 3600 }, key)
    expect(token.startsWith('mt_')).toBe(true)
    const payload = verifyMemberToken(token, key, now)
    expect(payload).not.toBeNull()
    expect(payload!.sub).toBe('alice')
    expect(payload!.pk).toBe('pk_demo')
  })

  it('만료된 토큰은 거부', () => {
    const now = 1_000_000
    const token = signMemberToken({ pk: 'pk_demo', sub: 'alice', exp: now - 1 }, key)
    expect(verifyMemberToken(token, key, now)).toBeNull()
  })

  it('서명이 다른 키면 거부', () => {
    const now = 1_000_000
    const token = signMemberToken({ pk: 'pk_demo', sub: 'alice', exp: now + 3600 }, key)
    const otherKey = deriveMemberTokenKey(hashSecret('sk_other'))
    expect(verifyMemberToken(token, otherKey, now)).toBeNull()
  })

  it('변조된 토큰·잘못된 형태는 거부', () => {
    expect(verifyMemberToken('not-a-token', key)).toBeNull()
    expect(verifyMemberToken('mt_abc', key)).toBeNull()
    expect(verifyMemberToken(undefined, key)).toBeNull()
  })

  it('명시 시크릿이 있으면 그것을 서명 키로 우선', () => {
    const explicit = deriveMemberTokenKey('ignored', 'my-explicit-secret')
    expect(explicit).toBe('my-explicit-secret')
  })
})
