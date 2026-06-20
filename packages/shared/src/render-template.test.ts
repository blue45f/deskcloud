import { describe, expect, it } from 'vitest'

import { extractTemplateVars, renderTemplate } from './render-template'

describe('renderTemplate', () => {
  it('단순 변수를 치환한다', () => {
    expect(renderTemplate('안녕하세요 {{name}}님', { name: '희준' })).toBe('안녕하세요 희준님')
  })

  it('토큰 내부 공백을 허용한다', () => {
    expect(renderTemplate('{{ greeting }}, {{  who  }}!', { greeting: 'Hi', who: 'there' })).toBe(
      'Hi, there!'
    )
  })

  it('점 표기로 중첩 값을 조회한다', () => {
    expect(renderTemplate('주문 {{order.id}} 배송됨', { order: { id: 'A-1' } })).toBe(
      '주문 A-1 배송됨'
    )
  })

  it('매칭되지 않는 변수는 빈 문자열로 치환한다', () => {
    expect(renderTemplate('Hi {{missing}}!', {})).toBe('Hi !')
  })

  it('숫자·불리언을 문자열로 변환한다', () => {
    expect(renderTemplate('잔액 {{n}}, 활성 {{ok}}', { n: 42, ok: true })).toBe('잔액 42, 활성 true')
  })

  it('null/undefined 는 빈 문자열', () => {
    expect(renderTemplate('[{{a}}][{{b}}]', { a: null, b: undefined })).toBe('[][]')
  })

  it('data 없이 호출해도 토큰을 비운다', () => {
    expect(renderTemplate('값: {{x}}')).toBe('값: ')
  })

  it('같은 변수를 여러 번 치환한다', () => {
    expect(renderTemplate('{{x}}-{{x}}', { x: 'z' })).toBe('z-z')
  })
})

describe('extractTemplateVars', () => {
  it('등장 순서로 변수명을 추출(중복 제거)', () => {
    expect(extractTemplateVars('{{a}} {{b.c}} {{a}}')).toEqual(['a', 'b.c'])
  })

  it('변수가 없으면 빈 배열', () => {
    expect(extractTemplateVars('plain text')).toEqual([])
  })
})
