import { describe, expect, it, vi } from 'vitest'

import { createNotifyDeskClient, NotifyDeskError } from './index'

import type { NotifyResultDto, TemplateDto } from '@notifydesk/shared'

const RESULT: NotifyResultDto = {
  notificationId: 'n1',
  recipientId: 'user_42',
  type: 'order.shipped',
  deliveries: [{ channel: 'in_app', status: 'delivered' }],
  suppressed: [],
  capExceeded: false,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
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

const SK = 'sk_0123456789abcdef0123456789abcdef'

describe('createNotifyDeskClient', () => {
  it('secretKey 가 sk_ 형식이 아니면 즉시 throw', () => {
    expect(() => createNotifyDeskClient({ secretKey: 'pk_x', endpoint: 'https://x' })).toThrow(
      NotifyDeskError
    )
    expect(() => createNotifyDeskClient({ secretKey: '', endpoint: 'https://x' })).toThrow(
      NotifyDeskError
    )
  })

  it('notify 는 POST /api/notify 로 recipientId 를 포함해 보낸다', async () => {
    const fetch = mockFetch(() => jsonResponse(RESULT, 201))
    const client = createNotifyDeskClient({ secretKey: SK, endpoint: 'https://api.example.com/', fetch })
    const out = await client.notify('user_42', {
      type: 'order.shipped',
      templateKey: 'order.shipped',
      data: { orderId: 'A-1024' },
    })
    expect(out).toEqual(RESULT)
    const [url, opts] = calls(fetch)[0]!
    expect(url).toBe('https://api.example.com/api/notify')
    expect(opts?.method).toBe('POST')
    const headers = opts?.headers as Record<string, string>
    expect(headers.authorization).toBe(`Bearer ${SK}`)
    expect(headers['x-notifydesk-sdk']).toBeDefined()
    expect(JSON.parse(opts?.body as string)).toEqual({
      recipientId: 'user_42',
      type: 'order.shipped',
      templateKey: 'order.shipped',
      data: { orderId: 'A-1024' },
    })
  })

  it('signal 은 body 직렬화에서 제외된다', async () => {
    const fetch = mockFetch(() => jsonResponse(RESULT, 201))
    const client = createNotifyDeskClient({ secretKey: SK, endpoint: 'https://x', fetch })
    await client.notify('u1', { type: 'system', body: 'hi', signal: new AbortController().signal })
    const body = JSON.parse(calls(fetch)[0]![1]?.body as string)
    expect(body).toEqual({ recipientId: 'u1', type: 'system', body: 'hi' })
    expect('signal' in body).toBe(false)
  })

  it('에러 응답은 NotifyDeskError(status·message)로 던진다', async () => {
    const fetch = mockFetch(() => jsonResponse({ message: 'boom' }, 500))
    const client = createNotifyDeskClient({ secretKey: SK, endpoint: 'https://x', fetch })
    await expect(client.notify('u1', { type: 't', body: 'b' })).rejects.toMatchObject({
      name: 'NotifyDeskError',
      status: 500,
      message: 'boom',
    })
  })

  it('배열 message(nestjs-zod)를 합쳐 보여준다', async () => {
    const fetch = mockFetch(() => jsonResponse({ message: ['a', 'b'] }, 400))
    const client = createNotifyDeskClient({ secretKey: SK, endpoint: 'https://x', fetch })
    await expect(client.notify('u1', { type: 't', body: 'b' })).rejects.toThrow('a, b')
  })

  it('template CRUD 는 key 를 URL 인코딩하고 올바른 메서드를 쓴다', async () => {
    const tpl: TemplateDto = {
      tenantId: 't1',
      key: 'order.shipped',
      channels: ['in_app'],
      subject: null,
      bodyTemplate: '{{x}}',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const fetch = mockFetch(() => jsonResponse(tpl))
    const client = createNotifyDeskClient({ secretKey: SK, endpoint: 'https://x', fetch })
    await client.getTemplate('a b')
    await client.deleteTemplate('a b')
    const c = calls(fetch)
    expect(c[0]![0]).toBe('https://x/api/admin/templates/a%20b')
    expect(c[1]![1]?.method).toBe('DELETE')
  })

  it('sentLog 는 offset·limit 를 쿼리스트링으로 직렬화한다', async () => {
    const fetch = mockFetch(() => jsonResponse({ items: [], total: 0, offset: 5, limit: 10 }))
    const client = createNotifyDeskClient({ secretKey: SK, endpoint: 'https://x', fetch })
    await client.sentLog({ offset: 5, limit: 10 })
    expect(calls(fetch)[0]![0]).toBe('https://x/api/admin/sent?offset=5&limit=10')
  })

  it('NotifyDeskError 는 Error 인스턴스다', () => {
    expect(new NotifyDeskError('m', 1)).toBeInstanceOf(Error)
  })
})
