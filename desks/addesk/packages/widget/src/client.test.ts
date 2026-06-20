import { describe, expect, it, vi } from 'vitest'

import { createAdDeskClient, AdDeskError } from './client'

import type { ServeDto, TrackReceiptDto } from '@addesk/shared'

const SERVED: ServeDto = {
  served: true,
  creativeId: 'cr1',
  imageUrl: 'https://cdn.example/banner.png',
  linkUrl: 'https://shop.example/landing',
  alt: '여름 세일',
  size: '300x250',
}

const RECEIPT: TrackReceiptDto = { ok: true, count: 1 }

const PK = 'pk_0123456789abcdef0123456789abcdef'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function mockFetch(impl: (url: string, init?: RequestInit) => Response): typeof fetch {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(impl(String(input), init))
  ) as unknown as typeof fetch
}

function calls(fn: typeof fetch): Array<[string, RequestInit | undefined]> {
  const m = fn as unknown as { mock: { calls: Array<[unknown, unknown]> } }
  return m.mock.calls.map(([u, i]) => [String(u), i as RequestInit | undefined])
}

describe('createAdDeskClient', () => {
  it('serve — GET /api/ads/serve?slot= 에 publishable 헤더를 싣는다', async () => {
    const fetch = mockFetch(() => jsonResponse(SERVED))
    const client = createAdDeskClient({
      publishableKey: PK,
      endpoint: 'https://ads.example.com/',
      fetch,
    })
    const out = await client.serve('sidebar')
    expect(out).toEqual(SERVED)

    const [url, opts] = calls(fetch)[0]!
    expect(url).toBe('https://ads.example.com/api/ads/serve?slot=sidebar')
    expect(opts?.method).toBe('GET')
    const headers = opts?.headers as Record<string, string>
    expect(headers.authorization).toBe(`Bearer ${PK}`)
    expect(headers['x-pk']).toBe(PK)
    expect(headers['x-addesk-widget']).toBeDefined()
  })

  it('endpoint 끝 슬래시를 정규화한다', async () => {
    const fetch = mockFetch(() => jsonResponse(SERVED))
    const client = createAdDeskClient({ publishableKey: PK, endpoint: 'https://x//', fetch })
    await client.serve('feed')
    expect(calls(fetch)[0]![0]).toBe('https://x/api/ads/serve?slot=feed')
  })

  it('slot 값을 URL 인코딩한다', async () => {
    const fetch = mockFetch(() => jsonResponse(SERVED))
    const client = createAdDeskClient({ publishableKey: PK, endpoint: 'https://x', fetch })
    await client.serve('a b')
    expect(calls(fetch)[0]![0]).toBe('https://x/api/ads/serve?slot=a%20b')
  })

  it('trackImpression — POST /api/ads/impression 에 creativeId 바디', async () => {
    const fetch = mockFetch(() => jsonResponse(RECEIPT))
    const client = createAdDeskClient({ publishableKey: PK, endpoint: 'https://x', fetch })
    const out = await client.trackImpression('cr1')
    expect(out).toEqual(RECEIPT)
    const [url, opts] = calls(fetch)[0]!
    expect(url).toBe('https://x/api/ads/impression')
    expect(opts?.method).toBe('POST')
    expect(JSON.parse(String(opts?.body))).toEqual({ creativeId: 'cr1' })
  })

  it('trackClick — POST /api/ads/click 에 creativeId 바디', async () => {
    const fetch = mockFetch(() => jsonResponse(RECEIPT))
    const client = createAdDeskClient({ publishableKey: PK, endpoint: 'https://x', fetch })
    await client.trackClick('cr9')
    const [url, opts] = calls(fetch)[0]!
    expect(url).toBe('https://x/api/ads/click')
    expect(JSON.parse(String(opts?.body))).toEqual({ creativeId: 'cr9' })
  })

  it('에러 응답은 AdDeskError(status·message)로 던진다', async () => {
    const fetch = mockFetch(() => jsonResponse({ message: 'forbidden' }, 403))
    const client = createAdDeskClient({ publishableKey: PK, endpoint: 'https://x', fetch })
    await expect(client.serve('sidebar')).rejects.toMatchObject({
      name: 'AdDeskError',
      status: 403,
      message: 'forbidden',
    })
  })

  it('배열 message(nestjs-zod 스타일)를 합쳐 보여준다', async () => {
    const fetch = mockFetch(() => jsonResponse({ message: ['slot: invalid', 'bad'] }, 400))
    const client = createAdDeskClient({ publishableKey: PK, endpoint: 'https://x', fetch })
    await expect(client.serve('sidebar')).rejects.toThrow('slot: invalid, bad')
  })

  it('402(무료 한도 초과)도 status 를 보존한다', async () => {
    const fetch = mockFetch(() => jsonResponse({ message: '한도 초과' }, 402))
    const client = createAdDeskClient({ publishableKey: PK, endpoint: 'https://x', fetch })
    await expect(client.serve('sidebar')).rejects.toMatchObject({ status: 402 })
  })

  it('AdDeskError 는 Error 인스턴스다', () => {
    expect(new AdDeskError('m', 1)).toBeInstanceOf(Error)
  })
})
