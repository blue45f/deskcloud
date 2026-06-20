import { describe, expect, it } from 'vitest'

import { applyTemplateVars, extractTemplateVars, unresolvedTemplateVars } from './template'

describe('applyTemplateVars', () => {
  it('치환: {{ key }} 공백 허용', () => {
    expect(
      applyTemplateVars('안녕 {{company_name}}, {{ plan }} 요금제', {
        company_name: 'Acme',
        plan: 'Pro',
      })
    ).toBe('안녕 Acme, Pro 요금제')
  })

  it('값이 없으면 자리표시자를 그대로 남긴다', () => {
    expect(applyTemplateVars('{{a}}/{{b}}', { a: 'X' })).toBe('X/{{b}}')
    expect(applyTemplateVars('{{a}}', { a: '' })).toBe('{{a}}')
  })

  it('동일 키 다중 등장 모두 치환', () => {
    expect(applyTemplateVars('{{x}}-{{x}}', { x: '1' })).toBe('1-1')
  })

  it('placeholder 가 없으면 원문 유지', () => {
    expect(applyTemplateVars('변수 없음', { a: '1' })).toBe('변수 없음')
  })
})

describe('extractTemplateVars', () => {
  it('등장하는 키를 중복 없이 수집', () => {
    expect(extractTemplateVars('{{a}} {{b}} {{a}}')).toEqual(['a', 'b'])
  })
  it('점·하이픈 키 허용', () => {
    expect(extractTemplateVars('{{user.name}} {{plan-id}}')).toEqual(['user.name', 'plan-id'])
  })
})

describe('unresolvedTemplateVars', () => {
  it('값이 주어지지 않은 키만 반환', () => {
    expect(unresolvedTemplateVars('{{a}} {{b}} {{c}}', { a: 'x', b: '' })).toEqual(['b', 'c'])
  })
})
