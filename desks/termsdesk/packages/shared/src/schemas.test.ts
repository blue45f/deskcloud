import { describe, expect, it } from 'vitest'

import { updateOrgSchema } from './schemas'

describe('updateOrgSchema (조직 브랜딩)', () => {
  it('accepts an http(s) logo URL alongside the org name', () => {
    const parsed = updateOrgSchema.parse({
      name: 'Rotifolk',
      logoUrl: 'https://rotifolk.example.com/icon.png',
    })

    expect(parsed.name).toBe('Rotifolk')
    expect(parsed.logoUrl).toBe('https://rotifolk.example.com/icon.png')
  })

  it('accepts a logo-only patch (name 생략)', () => {
    const parsed = updateOrgSchema.parse({ logoUrl: 'http://localhost:5270/favicon.svg' })

    expect(parsed.name).toBeUndefined()
    expect(parsed.logoUrl).toBe('http://localhost:5270/favicon.svg')
  })

  it('normalizes empty string to null — 로고 제거', () => {
    expect(updateOrgSchema.parse({ logoUrl: '' }).logoUrl).toBeNull()
    expect(updateOrgSchema.parse({ logoUrl: null }).logoUrl).toBeNull()
  })

  it('leaves logoUrl untouched when omitted (name-only patch)', () => {
    const parsed = updateOrgSchema.parse({ name: '우리 회사' })

    expect(parsed.logoUrl).toBeUndefined()
  })

  it('rejects data:/javascript:/ftp: URLs — http(s)만 허용', () => {
    for (const logoUrl of [
      'data:image/svg+xml;base64,PHN2Zy8+',
      'javascript:alert(1)',
      'ftp://files.example.com/logo.png',
    ]) {
      expect(updateOrgSchema.safeParse({ logoUrl }).success).toBe(false)
    }
  })

  it('rejects plain non-URL strings and overlong URLs', () => {
    expect(updateOrgSchema.safeParse({ logoUrl: 'not-a-url' }).success).toBe(false)
    expect(
      updateOrgSchema.safeParse({ logoUrl: `https://e.com/${'a'.repeat(2048)}` }).success
    ).toBe(false)
  })

  it('rejects an empty patch — 변경할 항목이 최소 1개 필요', () => {
    expect(updateOrgSchema.safeParse({}).success).toBe(false)
  })
})
