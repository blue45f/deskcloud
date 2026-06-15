import { describe, expect, it } from 'vitest'

import { isValidSlug, slugify } from './slug'

describe('slug', () => {
  it('정규화: 대소문자·공백·특수문자 처리', () => {
    expect(slugify('Acme Inc.')).toBe('acme-inc')
    expect(slugify('  Hello   World  ')).toBe('hello-world')
    expect(slugify('foo_bar')).toBe('foo-bar')
    expect(slugify('a--b---c')).toBe('a-b-c')
    expect(slugify('-leading-trailing-')).toBe('leading-trailing')
  })

  it('빈/비ASCII 결과는 fallback', () => {
    expect(slugify('!!!')).toBe('tenant')
    expect(slugify('   ')).toBe('tenant')
  })

  it('isValidSlug', () => {
    expect(isValidSlug('acme')).toBe(true)
    expect(isValidSlug('acme-inc-1')).toBe(true)
    expect(isValidSlug('Acme')).toBe(false)
    expect(isValidSlug('acme_')).toBe(false)
    expect(isValidSlug('-acme')).toBe(false)
    expect(isValidSlug('')).toBe(false)
  })
})
