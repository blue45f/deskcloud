import { describe, expect, it, vi } from 'vitest'

import { createReviewDeskClient, ReviewDeskError } from './client'

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

const opts = (fetchImpl: typeof fetch) => ({
  publishableKey: 'pk_test',
  endpoint: 'https://reviews.example.com/',
  fetch: fetchImpl,
})

/** mock.calls 첫 호출의 [url, init] 튜플을 타입드로 읽는 헬퍼(noUncheckedIndexedAccess 안전). */
function firstCall(fn: typeof fetch): { url: string; init: RequestInit } {
  const m = fn as unknown as { mock: { calls: Array<[unknown, RequestInit | undefined]> } }
  const call = m.mock.calls[0]
  if (!call) throw new Error('fetch was not called')
  return { url: String(call[0]), init: (call[1] ?? {}) as RequestInit }
}

/** init.headers 를 plain object 로 캐스팅. */
function hdrs(init: RequestInit): Record<string, string> {
  return (init.headers ?? {}) as Record<string, string>
}

describe('createReviewDeskClient', () => {
  it('throws without a publishableKey', () => {
    expect(() =>
      createReviewDeskClient({ publishableKey: '', endpoint: 'https://x', fetch: vi.fn() })
    ).toThrow(ReviewDeskError)
  })

  it('getAggregate sends x-pk header and subjectId query, strips trailing slash', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ count: 3, avgRating: 4.5, distribution: {}, satisfaction: 66 })
    ) as unknown as typeof fetch
    const client = createReviewDeskClient(opts(fetchImpl))

    const agg = await client.getAggregate('pro-plan')

    expect(agg.avgRating).toBe(4.5)
    const { url, init } = firstCall(fetchImpl)
    expect(url).toBe('https://reviews.example.com/api/reviews/aggregate?subjectId=pro-plan')
    expect(init.method).toBe('GET')
    expect(hdrs(init)['x-pk']).toBe('pk_test')
    expect(hdrs(init)['x-reviewdesk-widget']).toBeTruthy()
  })

  it('getReviews passes limit and returns the DTO', async () => {
    const dto = { subjectId: 'pro-plan', items: [], aggregate: { count: 0, avgRating: null, distribution: {}, satisfaction: null } }
    const fetchImpl = vi.fn(async () => jsonResponse(dto)) as unknown as typeof fetch
    const client = createReviewDeskClient(opts(fetchImpl))

    const res = await client.getReviews('pro-plan', 5)

    expect(res.subjectId).toBe('pro-plan')
    expect(firstCall(fetchImpl).url).toContain('/api/reviews?subjectId=pro-plan&limit=5')
  })

  it('getWall hits /api/reviews/wall', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ items: [] })) as unknown as typeof fetch
    const client = createReviewDeskClient(opts(fetchImpl))

    await client.getWall(10)

    expect(firstCall(fetchImpl).url).toBe('https://reviews.example.com/api/reviews/wall?limit=10')
  })

  it('submitReview POSTs JSON with content-type', async () => {
    const receipt = { id: 'rev_1', subjectId: 'pro-plan', status: 'pending', createdAt: '2026-01-01T00:00:00Z' }
    const fetchImpl = vi.fn(async () =>
      jsonResponse(receipt, { status: 201 })
    ) as unknown as typeof fetch
    const client = createReviewDeskClient(opts(fetchImpl))

    const res = await client.submitReview({
      subjectId: 'pro-plan',
      rating: 5,
      body: 'great',
      authorName: 'Kim',
    })

    expect(res.id).toBe('rev_1')
    const { url, init } = firstCall(fetchImpl)
    expect(url).toBe('https://reviews.example.com/api/reviews')
    expect(init.method).toBe('POST')
    expect(hdrs(init)['content-type']).toBe('application/json')
    expect(hdrs(init)['x-pk']).toBe('pk_test')
    expect(JSON.parse(String(init.body)).rating).toBe(5)
  })

  it('throws ReviewDeskError with server message on non-2xx', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ message: '유효하지 않은 publishable 키입니다' }, { status: 401 })
    ) as unknown as typeof fetch
    const client = createReviewDeskClient(opts(fetchImpl))

    await expect(client.getAggregate('pro-plan')).rejects.toMatchObject({
      name: 'ReviewDeskError',
      status: 401,
      message: '유효하지 않은 publishable 키입니다',
    })
  })

  it('joins array error messages (nestjs-zod style)', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ message: ['body는 필수입니다', 'rating은 1–5'] }, { status: 400 })
    ) as unknown as typeof fetch
    const client = createReviewDeskClient(opts(fetchImpl))

    await expect(
      client.submitReview({ subjectId: 'x', rating: 0 as number, body: '', authorName: '' })
    ).rejects.toThrow('body는 필수입니다, rating은 1–5')
  })
})
