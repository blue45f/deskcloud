import { describe, expect, it, vi } from 'vitest'

import {
  buildUrlFrom,
  createMediaDeskClient,
  MediaDeskError,
  transformQuery,
} from './client'

describe('transformQuery', () => {
  it('빈 변환은 빈 문자열', () => {
    expect(transformQuery()).toBe('')
    expect(transformQuery({})).toBe('')
  })

  it('w/h/format/q 를 직렬화한다', () => {
    const q = transformQuery({ w: 240, h: 120, format: 'webp', q: 70 })
    const params = new URLSearchParams(q)
    expect(params.get('w')).toBe('240')
    expect(params.get('h')).toBe('120')
    expect(params.get('format')).toBe('webp')
    expect(params.get('q')).toBe('70')
  })

  it('범위를 벗어난 치수·품질은 클램프한다', () => {
    const p = new URLSearchParams(transformQuery({ w: 99999, h: 0, q: 999 }))
    expect(p.get('w')).toBe('4000')
    expect(p.get('h')).toBe('1')
    expect(p.get('q')).toBe('100')
  })

  it('알 수 없는 포맷·비유한 값은 무시한다', () => {
    const p = new URLSearchParams(
      transformQuery({ format: 'tiff' as never, w: Number.NaN, q: Number.POSITIVE_INFINITY })
    )
    expect(p.has('format')).toBe(false)
    expect(p.has('w')).toBe(false)
    expect(p.has('q')).toBe(false)
  })
})

describe('buildUrlFrom', () => {
  it('상대 키를 /file/ 경로로 조합한다', () => {
    expect(buildUrlFrom('https://m.example.com/', 'avatars/a.png')).toBe(
      'https://m.example.com/file/avatars/a.png'
    )
  })

  it('변환 쿼리를 덧붙인다', () => {
    const url = buildUrlFrom('https://m.example.com', 'a.png', { w: 100, format: 'webp' })
    expect(url.startsWith('https://m.example.com/file/a.png?')).toBe(true)
    const q = new URLSearchParams(url.split('?')[1])
    expect(q.get('w')).toBe('100')
    expect(q.get('format')).toBe('webp')
  })

  it('이미 절대 URL인 키는 그대로 두고 쿼리만 덧붙인다', () => {
    const url = buildUrlFrom('https://m.example.com', 'https://cdn.x/y.png', { w: 50 })
    expect(url).toBe('https://cdn.x/y.png?w=50')
  })

  it('절대 URL에 기존 쿼리가 있으면 & 로 잇는다', () => {
    const url = buildUrlFrom('https://m.example.com', 'https://cdn.x/y.png?v=2', { w: 50 })
    expect(url).toBe('https://cdn.x/y.png?v=2&w=50')
  })
})

describe('createMediaDeskClient', () => {
  it('정규화된 endpoint와 키를 노출한다', () => {
    const md = createMediaDeskClient({
      publishableKey: 'pk_test',
      endpoint: 'https://m.example.com//',
    })
    expect(md.endpoint).toBe('https://m.example.com')
    expect(md.publishableKey).toBe('pk_test')
  })

  it('listAssets 는 publishable 키 헤더를 보낸다', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
        new Response(JSON.stringify({ items: [], total: 0, offset: 0, limit: 20 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    )
    const md = createMediaDeskClient({
      publishableKey: 'pk_test',
      endpoint: 'https://m.example.com',
      fetch: fetchMock as unknown as typeof fetch,
    })
    const res = await md.listAssets({ folder: 'avatars', limit: 10 })
    expect(res.total).toBe(0)
    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()
    const [calledUrl, init] = call!
    expect(String(calledUrl)).toContain('/api/assets')
    expect(String(calledUrl)).toContain('folder=avatars')
    const headers = (init?.headers ?? {}) as Record<string, string>
    expect(headers['x-publishable-key']).toBe('pk_test')
  })

  it('listAssets 는 비-OK 응답에서 MediaDeskError 를 던진다', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ message: '권한 없음' }), { status: 401 })
    )
    const md = createMediaDeskClient({
      publishableKey: 'pk_bad',
      endpoint: 'https://m.example.com',
      fetch: fetchMock as unknown as typeof fetch,
    })
    await expect(md.listAssets()).rejects.toBeInstanceOf(MediaDeskError)
  })

  it('XHR 부재 시 upload 가 fetch 로 폴백한다', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          key: 'a.png',
          url: 'https://m.example.com/file/a.png',
          contentType: 'image/png',
          size: 3,
          folder: null,
          transformable: true,
          createdAt: new Date().toISOString(),
        }),
        { status: 201, headers: { 'content-type': 'application/json' } }
      )
    )
    const md = createMediaDeskClient({
      publishableKey: 'pk_test',
      endpoint: 'https://m.example.com',
      fetch: fetchMock as unknown as typeof fetch,
    })
    const progress: number[] = []
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const result = await md.upload(blob, { onProgress: (p) => progress.push(p), filename: 'a.png' })
    expect(result.key).toBe('a.png')
    expect(progress[0]).toBe(0)
    expect(progress[progress.length - 1]).toBe(1)
  })
})
