import { describe, expect, it } from 'vitest'

import { formatRelativeTime } from './relative-time'

const NOW = new Date('2026-06-15T12:00:00.000Z')

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString()
}

describe('formatRelativeTime', () => {
  it('수 초 전은 "방금 전"류로 표시한다', () => {
    const out = formatRelativeTime(ago(5_000), NOW)
    expect(out).toMatch(/방금|지금|초/)
  })

  it('분 단위', () => {
    expect(formatRelativeTime(ago(3 * 60_000), NOW)).toContain('분')
  })

  it('시간 단위', () => {
    expect(formatRelativeTime(ago(2 * 3_600_000), NOW)).toContain('시간')
  })

  it('일 단위', () => {
    expect(formatRelativeTime(ago(3 * 86_400_000), NOW)).toContain('일')
  })

  it('일주일 이상은 절대 날짜(월/일)로 표시한다', () => {
    const out = formatRelativeTime(ago(40 * 86_400_000), NOW)
    expect(out).toMatch(/월|\d/)
    expect(out).not.toContain('일 전')
  })

  it('잘못된 날짜는 빈 문자열', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('')
  })
})
