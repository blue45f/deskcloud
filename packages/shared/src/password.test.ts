import { describe, expect, it } from 'vitest'

import {
  hashPassword,
  normalizeEmail,
  passwordClassCount,
  validatePassword,
  verifyPassword,
} from './password'

describe('validatePassword', () => {
  it('정책을 만족하는 비밀번호를 통과시킨다', () => {
    const r = validatePassword('hunter2!pw')
    expect(r.ok).toBe(true)
    expect(r.reasons).toHaveLength(0)
  })

  it('너무 짧으면 거부한다', () => {
    const r = validatePassword('a1')
    expect(r.ok).toBe(false)
    expect(r.reasons.some((m) => m.includes('최소'))).toBe(true)
  })

  it('너무 길면 거부한다', () => {
    const r = validatePassword('aB1'.repeat(100))
    expect(r.ok).toBe(false)
    expect(r.reasons.some((m) => m.includes('최대'))).toBe(true)
  })

  it('문자 클래스가 1종뿐이면 거부한다(다양성 부족)', () => {
    const r = validatePassword('aaaaaaaaaa')
    expect(r.ok).toBe(false)
    expect(r.reasons.some((m) => m.includes('2종류'))).toBe(true)
  })

  it('공백만이면 거부한다', () => {
    const r = validatePassword('          ')
    expect(r.ok).toBe(false)
  })

  it('문자열이 아니면 거부한다', () => {
    expect(validatePassword(12345678 as unknown).ok).toBe(false)
    expect(validatePassword(undefined as unknown).ok).toBe(false)
  })

  it('사유 메시지에 비밀번호 평문을 포함하지 않는다', () => {
    const secret = 'supersecretvalue'
    const r = validatePassword(secret) // 1종(소문자)뿐 → 실패
    expect(r.ok).toBe(false)
    for (const reason of r.reasons) expect(reason).not.toContain(secret)
  })
})

describe('passwordClassCount', () => {
  it('포함한 문자 클래스 수를 센다', () => {
    expect(passwordClassCount('abcdef')).toBe(1)
    expect(passwordClassCount('abc123')).toBe(2)
    expect(passwordClassCount('Abc123')).toBe(3)
    expect(passwordClassCount('Abc123!')).toBe(4)
  })
})

describe('normalizeEmail', () => {
  it('소문자화 + trim 한다', () => {
    expect(normalizeEmail('  Foo@Example.COM ')).toBe('foo@example.com')
  })
})

describe('hashPassword / verifyPassword (scrypt)', () => {
  it('해시는 scrypt$ 형식이고 평문을 포함하지 않는다', async () => {
    const pw = 'hunter2!pw'
    const hash = await hashPassword(pw)
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(hash).not.toContain(pw)
    // salt 가 무작위이므로 같은 비밀번호도 매번 다른 해시
    expect(await hashPassword(pw)).not.toBe(hash)
  })

  it('올바른 비밀번호만 검증을 통과한다', async () => {
    const hash = await hashPassword('Correct-horse-1')
    expect(await verifyPassword('Correct-horse-1', hash)).toBe(true)
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('형식이 깨진 해시는 throw 없이 false', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false)
    expect(await verifyPassword('x', 'scrypt$bad')).toBe(false)
    expect(await verifyPassword('x', '')).toBe(false)
    expect(await verifyPassword('x', 'scrypt$0$ab$cd')).toBe(false)
  })
})
