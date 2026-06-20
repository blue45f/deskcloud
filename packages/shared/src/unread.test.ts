import { describe, expect, it } from 'vitest'

import { isOriginAllowed } from './cors'
import { computeUnread } from './unread'

describe('computeUnread', () => {
  const ids = ['e5', 'e4', 'e3', 'e2', 'e1'] // 최신순

  it('처음 방문(lastSeen 없음)은 전부 미읽음', () => {
    const r = computeUnread(ids, null)
    expect(r.unreadCount).toBe(5)
    expect(r.latestEntryId).toBe('e5')
  })

  it('중간 항목을 마지막으로 봤으면 그보다 최신만 미읽음', () => {
    const r = computeUnread(ids, 'e3')
    expect(r.unreadCount).toBe(2) // e5, e4
    expect(r.latestEntryId).toBe('e5')
  })

  it('최신을 봤으면 미읽음 0', () => {
    expect(computeUnread(ids, 'e5').unreadCount).toBe(0)
  })

  it('목록에 없는 id(삭제됨/처음)는 전부 미읽음', () => {
    expect(computeUnread(ids, 'gone').unreadCount).toBe(5)
  })

  it('빈 목록은 0', () => {
    const r = computeUnread([], null)
    expect(r.unreadCount).toBe(0)
    expect(r.latestEntryId).toBeNull()
  })
})

describe('isOriginAllowed (CORS 정책)', () => {
  it('와일드카드는 모든 Origin 허용', () => {
    expect(isOriginAllowed('https://anything.com', ['*'])).toBe(true)
    expect(isOriginAllowed(undefined, ['*'])).toBe(true)
  })

  it('정확히 일치하는 Origin 만 허용', () => {
    const list = ['https://app.acme.com', 'http://localhost:3000']
    expect(isOriginAllowed('https://app.acme.com', list)).toBe(true)
    expect(isOriginAllowed('http://localhost:3000', list)).toBe(true)
    expect(isOriginAllowed('https://evil.com', list)).toBe(false)
  })

  it('트레일링 슬래시·대소문자 정규화', () => {
    expect(isOriginAllowed('https://App.Acme.com/', ['https://app.acme.com'])).toBe(true)
  })

  it('Origin 헤더 부재는 와일드카드가 아니면 거부', () => {
    expect(isOriginAllowed(undefined, ['https://app.acme.com'])).toBe(false)
    expect(isOriginAllowed('', ['https://app.acme.com'])).toBe(false)
  })
})
