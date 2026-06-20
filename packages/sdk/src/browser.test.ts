import { describe, expect, it, vi } from 'vitest'

import { createCommunityBrowserClient } from './browser'
import { CommunityDeskError, NotFoundError } from './http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** vi.fn with the global fetch signature so mock.calls is typed as [input, init?]. */
function makeFetch(impl: () => Promise<Response>) {
  return vi.fn<typeof fetch>(impl as unknown as typeof fetch)
}

describe('createCommunityBrowserClient', () => {
  it('sends pk header and /api prefix on listBoards', async () => {
    const fetchMock = makeFetch(async () => jsonResponse([{ slug: 'free' }]))
    const client = createCommunityBrowserClient({
      publishableKey: 'pk_demo',
      endpoint: 'https://c.example.com/',
      fetch: fetchMock,
    })

    const boards = await client.listBoards()
    expect(boards).toEqual([{ slug: 'free' }])

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://c.example.com/api/boards')
    expect(init?.method).toBe('GET')
    const headers = init?.headers as Record<string, string>
    expect(headers['x-pk']).toBe('pk_demo')
  })

  it('serializes list query params (sort/tag/limit/offset)', async () => {
    const fetchMock = makeFetch(async () => jsonResponse({ items: [], total: 0, offset: 0, limit: 20 }))
    const client = createCommunityBrowserClient({
      publishableKey: 'pk_demo',
      endpoint: 'https://c.example.com',
      fetch: fetchMock,
    })

    await client.listPosts('free', { sort: 'popular', tag: 'qna', limit: 5, offset: 10 })
    const url = String(fetchMock.mock.calls[0]![0])
    expect(url).toContain('/api/boards/free/posts?')
    expect(url).toContain('sort=popular')
    expect(url).toContain('tag=qna')
    expect(url).toContain('limit=5')
    expect(url).toContain('offset=10')
  })

  it('POSTs createPost with JSON body + content-type', async () => {
    const fetchMock = makeFetch(async () =>
      jsonResponse({ id: 'p1', status: 'visible', createdAt: 'now' }, 201)
    )
    const client = createCommunityBrowserClient({
      publishableKey: 'pk_demo',
      endpoint: 'https://c.example.com',
      fetch: fetchMock,
    })

    const receipt = await client.createPost({
      boardSlug: 'free',
      authorMemberId: 'u1',
      authorName: '준호',
      body: 'hello',
      tags: [],
    })
    expect(receipt.id).toBe('p1')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://c.example.com/api/posts')
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string>
    expect(headers['content-type']).toBe('application/json')
    expect(JSON.parse(init?.body as string).boardSlug).toBe('free')
  })

  it('throws NotFoundError on 404', async () => {
    const fetchMock = makeFetch(async () => jsonResponse({ message: 'nope' }, 404))
    const client = createCommunityBrowserClient({
      publishableKey: 'pk_demo',
      endpoint: 'https://c.example.com',
      fetch: fetchMock,
    })
    await expect(client.getPost('missing')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws CommunityDeskError with status on 403', async () => {
    const fetchMock = makeFetch(async () => jsonResponse({ message: 'origin denied' }, 403))
    const client = createCommunityBrowserClient({
      publishableKey: 'pk_demo',
      endpoint: 'https://c.example.com',
      fetch: fetchMock,
    })
    await expect(client.listBoards()).rejects.toMatchObject({
      name: 'CommunityDeskError',
      status: 403,
    })
    expect(CommunityDeskError).toBeDefined()
  })
})
