import { describe, expect, it } from 'vitest'

import { REACTION_META, REACTION_ORDER, relativeTime } from './util'

describe('relativeTime', () => {
  const now = Date.parse('2026-06-15T12:00:00Z')

  it('shows 방금 for <60s', () => {
    expect(relativeTime('2026-06-15T11:59:30Z', now)).toBe('방금')
  })
  it('shows minutes/hours/days', () => {
    expect(relativeTime('2026-06-15T11:30:00Z', now)).toBe('30분 전')
    expect(relativeTime('2026-06-15T09:00:00Z', now)).toBe('3시간 전')
    expect(relativeTime('2026-06-13T12:00:00Z', now)).toBe('2일 전')
  })
  it('falls back to a date for >=7d (same year → MM.DD)', () => {
    expect(relativeTime('2026-05-01T12:00:00Z', now)).toMatch(/^\d{2}\.\d{2}$/)
  })
  it('uses YYYY.MM.DD across years', () => {
    expect(relativeTime('2024-01-02T12:00:00Z', now)).toMatch(/^\d{4}\.\d{2}\.\d{2}$/)
  })
  it('returns empty for invalid input', () => {
    expect(relativeTime('not-a-date', now)).toBe('')
  })
})

describe('reaction meta', () => {
  it('has emoji + label for every reaction kind', () => {
    for (const k of REACTION_ORDER) {
      expect(REACTION_META[k].emoji.length).toBeGreaterThan(0)
      expect(REACTION_META[k].label.length).toBeGreaterThan(0)
    }
  })
  it('exposes all six kinds in a stable order', () => {
    expect(REACTION_ORDER).toEqual(['like', 'love', 'laugh', 'wow', 'sad', 'angry'])
  })
})
