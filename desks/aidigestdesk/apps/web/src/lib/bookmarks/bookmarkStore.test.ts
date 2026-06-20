/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearBookmarks,
  isBookmarked,
  listBookmarks,
  removeBookmark,
  subscribeBookmarks,
  toggleBookmark,
} from './bookmarkStore'

const baseInput = {
  sourceId: 'gpt-x',
  kind: 'model' as const,
  title: 'GPT-X',
  subtitle: 'OpenAI',
  route: 'models' as const,
  anchor: 'comparison',
}

describe('bookmarkStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('toggles a bookmark on and off and reports the resulting state', () => {
    expect(isBookmarked('model', 'gpt-x')).toBe(false)

    const added = toggleBookmark(baseInput)
    expect(added).toBe(true)
    expect(isBookmarked('model', 'gpt-x')).toBe(true)

    const removed = toggleBookmark(baseInput)
    expect(removed).toBe(false)
    expect(isBookmarked('model', 'gpt-x')).toBe(false)
  })

  it('keys bookmarks by kind + sourceId so different kinds do not collide', () => {
    toggleBookmark(baseInput)
    toggleBookmark({ ...baseInput, kind: 'benchmark', route: 'models', anchor: 'benchmarks' })

    expect(isBookmarked('model', 'gpt-x')).toBe(true)
    expect(isBookmarked('benchmark', 'gpt-x')).toBe(true)
    expect(listBookmarks()).toHaveLength(2)
  })

  it('orders bookmarks newest-first and supports targeted + full removal', () => {
    toggleBookmark({ ...baseInput, sourceId: 'older' })
    toggleBookmark({ ...baseInput, sourceId: 'newer', title: 'Newer' })

    const ordered = listBookmarks()
    expect(ordered[0]?.title).toBe('Newer')

    removeBookmark('model:older')
    expect(listBookmarks().map((bookmark) => bookmark.id)).toEqual(['model:newer'])

    clearBookmarks()
    expect(listBookmarks()).toHaveLength(0)
  })

  it('notifies subscribers when bookmarks change and stops after unsubscribe', () => {
    let calls = 0
    const unsubscribe = subscribeBookmarks(() => {
      calls += 1
    })

    toggleBookmark(baseInput)
    expect(calls).toBe(1)

    unsubscribe()
    toggleBookmark(baseInput)
    expect(calls).toBe(1)
  })

  it('ignores corrupted localStorage payloads without throwing', () => {
    window.localStorage.setItem('aidigestdesk.bookmarks.v1', '{not json')
    expect(listBookmarks()).toEqual([])

    window.localStorage.setItem('aidigestdesk.bookmarks.v1', '{"unexpected":"object"}')
    expect(listBookmarks()).toEqual([])
  })
})
