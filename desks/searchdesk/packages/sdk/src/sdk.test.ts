import { describe, expect, it } from 'vitest'

import { SearchDeskError } from './http'
import { createIndexer } from './indexer'
import { createSearchClient } from './search-client'

import type { DeleteResultDto, IndexResultDto, SearchResponseDto } from '@searchdesk/shared'

const SEARCH: SearchResponseDto = {
  query: 'index',
  index: 'default',
  total: 1,
  hits: [
    {
      id: 'd1',
      index: 'default',
      title: 'Indexing',
      titleHighlight: '<mark>Index</mark>ing',
      url: null,
      category: 'docs',
      tags: ['indexing'],
      attrs: null,
      snippet: null,
      score: 12,
    },
  ],
  facets: { category: [{ value: 'docs', count: 1 }], tags: [{ value: 'indexing', count: 1 }] },
  limit: 10,
  engine: 'fallback',
}

const INDEX_RESULT: IndexResultDto = { upserted: 1, docCount: 5, capExceeded: false }
const DELETE_RESULT: DeleteResultDto = { deleted: true, docCount: 4 }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

interface MockFetch {
  fn: typeof fetch
  calls: () => Array<[string, RequestInit | undefined]>
}

function mockFetch(impl: (url: string, init?: RequestInit) => Response): MockFetch {
  const recorded: Array<[string, RequestInit | undefined]> = []
  const fn = ((input: RequestInfo | URL, init?: RequestInit) => {
    recorded.push([String(input), init])
    return Promise.resolve(impl(String(input), init))
  }) as unknown as typeof fetch
  return { fn, calls: () => recorded }
}

describe('createSearchClient', () => {
  it('pk_ 가 아니면 즉시 SearchDeskError', () => {
    expect(() => createSearchClient({ publishableKey: 'sk_oops', endpoint: 'https://x' })).toThrow(
      SearchDeskError
    )
  })

  it('q·index·category·tags·limit 를 쿼리스트링으로 구성하고 Bearer pk_ 를 보낸다', async () => {
    const m = mockFetch(() => jsonResponse(SEARCH))
    const client = createSearchClient({
      publishableKey: 'pk_demo',
      endpoint: 'https://api.example.com/',
      indexName: 'help',
      fetch: m.fn,
    })
    const out = await client.search('hello world', {
      category: 'docs',
      tags: ['a', 'b'],
      limit: 5,
    })
    expect(out).toEqual(SEARCH)
    const [url, init] = m.calls()[0]!
    const u = new URL(url)
    expect(u.origin + u.pathname).toBe('https://api.example.com/api/search')
    expect(u.searchParams.get('q')).toBe('hello world')
    expect(u.searchParams.get('index')).toBe('help')
    expect(u.searchParams.get('category')).toBe('docs')
    expect(u.searchParams.get('tags')).toBe('a,b')
    expect(u.searchParams.get('limit')).toBe('5')
    const headers = init?.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer pk_demo')
    expect(headers['x-searchdesk-sdk']).toBeDefined()
  })

  it('opts.index 가 클라이언트 기본 indexName 을 덮어쓴다', async () => {
    const m = mockFetch(() => jsonResponse(SEARCH))
    const client = createSearchClient({
      publishableKey: 'pk_demo',
      endpoint: 'https://x',
      indexName: 'help',
      fetch: m.fn,
    })
    await client.search('q', { index: 'blog' })
    expect(new URL(m.calls()[0]![0]).searchParams.get('index')).toBe('blog')
  })

  it('빈 쿼리도 q= 로 보낸다(서버가 facets 만 반환)', async () => {
    const m = mockFetch(() => jsonResponse({ ...SEARCH, query: '', total: 0, hits: [] }))
    const client = createSearchClient({
      publishableKey: 'pk_x',
      endpoint: 'https://x',
      fetch: m.fn,
    })
    await client.search('')
    expect(new URL(m.calls()[0]![0]).searchParams.get('q')).toBe('')
  })

  it('서버 에러는 SearchDeskError(status·message)로 던진다', async () => {
    const m = mockFetch(() => jsonResponse({ message: 'forbidden origin' }, 403))
    const client = createSearchClient({
      publishableKey: 'pk_x',
      endpoint: 'https://x',
      fetch: m.fn,
    })
    await expect(client.search('q')).rejects.toMatchObject({
      name: 'SearchDeskError',
      status: 403,
      message: 'forbidden origin',
    })
  })

  it('배열 message(nestjs-zod)를 합쳐 보여준다', async () => {
    const m = mockFetch(() => jsonResponse({ message: ['a', 'b'] }, 400))
    const client = createSearchClient({
      publishableKey: 'pk_x',
      endpoint: 'https://x',
      fetch: m.fn,
    })
    await expect(client.search('q')).rejects.toThrow('a, b')
  })
})

describe('createIndexer', () => {
  it('sk_ 가 아니면 즉시 SearchDeskError', () => {
    expect(() => createIndexer({ secretKey: 'pk_oops', endpoint: 'https://x' })).toThrow(
      SearchDeskError
    )
  })

  it('upsert 는 document 를 감싸고 기본 인덱스를 채워 POST 한다', async () => {
    const m = mockFetch(() => jsonResponse(INDEX_RESULT, 201))
    const indexer = createIndexer({
      secretKey: 'sk_demo',
      endpoint: 'https://x',
      indexName: 'help',
      fetch: m.fn,
    })
    const out = await indexer.upsert({ id: 'd1', title: 'T', body: 'B' })
    expect(out).toEqual(INDEX_RESULT)
    const [url, init] = m.calls()[0]!
    expect(url).toBe('https://x/api/docs')
    expect(init?.method).toBe('POST')
    const body = JSON.parse(init?.body as string)
    expect(body).toEqual({ document: { id: 'd1', title: 'T', body: 'B', index: 'help' } })
    const headers = init?.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer sk_demo')
    expect(headers['content-type']).toBe('application/json')
  })

  it('문서에 index 가 이미 있으면 유지한다', async () => {
    const m = mockFetch(() => jsonResponse(INDEX_RESULT, 201))
    const indexer = createIndexer({
      secretKey: 'sk_x',
      endpoint: 'https://x',
      indexName: 'help',
      fetch: m.fn,
    })
    await indexer.upsert({ id: 'd1', title: 'T', index: 'custom' })
    const body = JSON.parse(m.calls()[0]![1]?.body as string)
    expect(body.document.index).toBe('custom')
  })

  it('upsertMany 는 documents[] 로 보내고 각 문서에 기본 인덱스를 채운다', async () => {
    const m = mockFetch(() => jsonResponse({ ...INDEX_RESULT, upserted: 2 }, 201))
    const indexer = createIndexer({ secretKey: 'sk_x', endpoint: 'https://x', fetch: m.fn })
    await indexer.upsertMany([
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B', index: 'other' },
    ])
    const body = JSON.parse(m.calls()[0]![1]?.body as string)
    expect(body.documents).toHaveLength(2)
    expect(body.documents[0].index).toBe('default')
    expect(body.documents[1].index).toBe('other')
  })

  it('delete 는 id 를 인코딩하고 index 쿼리를 붙여 DELETE 한다', async () => {
    const m = mockFetch(() => jsonResponse(DELETE_RESULT))
    const indexer = createIndexer({
      secretKey: 'sk_x',
      endpoint: 'https://x',
      indexName: 'help',
      fetch: m.fn,
    })
    const out = await indexer.delete('a:b')
    expect(out).toEqual(DELETE_RESULT)
    const [url, init] = m.calls()[0]!
    expect(url).toBe('https://x/api/docs/a%3Ab?index=help')
    expect(init?.method).toBe('DELETE')
  })
})
