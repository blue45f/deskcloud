import { describe, expect, it } from 'vitest'

import { isOriginAllowed } from './cors'

describe('CORS allowlist', () => {
  it("'*' 은 모든 origin 허용", () => {
    expect(isOriginAllowed('https://anything.example', ['*'])).toBe(true)
    expect(isOriginAllowed(undefined, ['*'])).toBe(true)
  })

  it('정확 일치(대소문자·trailing slash 무시)', () => {
    const allow = ['https://app.example']
    expect(isOriginAllowed('https://app.example', allow)).toBe(true)
    expect(isOriginAllowed('https://APP.example/', allow)).toBe(true)
    expect(isOriginAllowed('https://other.example', allow)).toBe(false)
  })

  it('scheme/port 구분', () => {
    const allow = ['https://app.example:8443']
    expect(isOriginAllowed('https://app.example:8443', allow)).toBe(true)
    expect(isOriginAllowed('http://app.example:8443', allow)).toBe(false)
    expect(isOriginAllowed('https://app.example', allow)).toBe(false)
  })

  it('origin 없음 + 빈 allowlist → 거부', () => {
    expect(isOriginAllowed(undefined, [])).toBe(false)
    expect(isOriginAllowed('https://x.example', [])).toBe(false)
  })
})
