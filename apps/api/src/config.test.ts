import { describe, expect, it } from 'vitest'

import { normalizeChatPath } from './config'

describe('normalizeChatPath', () => {
  it('선행 슬래시 보장', () => {
    expect(normalizeChatPath('chat')).toBe('/chat')
  })

  it('트레일링 슬래시 제거(게이트웨이 정확 매칭)', () => {
    expect(normalizeChatPath('/chat/')).toBe('/chat')
    expect(normalizeChatPath('/chat///')).toBe('/chat')
  })

  it('빈/미지정은 기본 /chat', () => {
    expect(normalizeChatPath(undefined)).toBe('/chat')
    expect(normalizeChatPath('')).toBe('/chat')
    expect(normalizeChatPath('/')).toBe('/chat')
  })

  it('커스텀 경로 보존', () => {
    expect(normalizeChatPath('/messaging')).toBe('/messaging')
  })
})
