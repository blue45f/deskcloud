import { describe, expect, it, vi } from 'vitest'

import {
  ChangelogDeskError,
  createChangelogDeskClient,
} from './client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const OPTS = { publishableKey: 'pk_test', endpoint: 'https://changelog.example.com/' }

describe('createChangelogDeskClient', () => {
  it('listEntries 가 limit/since 쿼리와 x-pk 헤더를 보낸다', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ tenant: { name: 'Acme', slug: 'acme' }, items: [], total: 0 })
    )
    const client = createChangelogDeskClient({ ...OPTS, fetch: fetchMock })

    const res = await client.listEntries({ limit: 5, since: '2026-06-01T00:00:00.000Z' })

    expect(res.total).toBe(0)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe(
      'https://changelog.example.com/api/changelog?limit=5&since=2026-06-01T00%3A00%3A00.000Z'
    )
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers['x-pk']).toBe('pk_test')
    expect(headers['x-changelogdesk-widget']).toBeDefined()
  })

  it('listEntries 가 파라미터 없이도 베이스 경로를 친다(끝 슬래시 정규화)', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ tenant: { name: 'Acme', slug: 'acme' }, items: [], total: 0 })
    )
    const client = createChangelogDeskClient({ ...OPTS, fetch: fetchMock })

    await client.listEntries()

    const [url] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('https://changelog.example.com/api/changelog')
  })

  it('getUnreadCount 가 anonId 쿼리를 보낸다', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ unreadCount: 3, latestEntryId: 'e1' })
    )
    const client = createChangelogDeskClient({ ...OPTS, fetch: fetchMock })

    const res = await client.getUnreadCount('anon-123')

    expect(res.unreadCount).toBe(3)
    const [url] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe(
      'https://changelog.example.com/api/changelog/unread-count?anonId=anon-123'
    )
  })

  it('markSeen 이 POST body 로 anonId/lastSeenEntryId 를 보낸다', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) => jsonResponse({ ok: true }))
    const client = createChangelogDeskClient({ ...OPTS, fetch: fetchMock })

    await client.markSeen({ anonId: 'anon-123', lastSeenEntryId: 'e9' })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('https://changelog.example.com/api/changelog/seen')
    expect((init as RequestInit).method).toBe('POST')
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      anonId: 'anon-123',
      lastSeenEntryId: 'e9',
    })
  })

  it('비-2xx 응답은 ChangelogDeskError(상태 포함)로 던진다', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ message: '유효하지 않은 퍼블리시 키입니다' }, 401)
    )
    const client = createChangelogDeskClient({ ...OPTS, fetch: fetchMock })

    await expect(client.listEntries()).rejects.toMatchObject({
      name: 'ChangelogDeskError',
      status: 401,
      message: '유효하지 않은 퍼블리시 키입니다',
    })
  })

  it('fetch 가 없으면 생성 시점에 에러', () => {
    expect(() =>
      createChangelogDeskClient({
        ...OPTS,
        fetch: undefined as unknown as typeof fetch,
      })
    ).not.toThrow() // 전역 fetch 가 있으면 통과

    const orig = globalThis.fetch
    // @ts-expect-error 테스트: 전역 fetch 제거
    delete globalThis.fetch
    try {
      expect(() => createChangelogDeskClient(OPTS)).toThrow(ChangelogDeskError)
    } finally {
      globalThis.fetch = orig
    }
  })
})
