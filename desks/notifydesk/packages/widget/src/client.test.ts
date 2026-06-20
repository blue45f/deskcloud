import { describe, expect, it, vi } from 'vitest'

import {
  createNotifyDeskWidgetClient,
  NotifyDeskWidgetError,
} from './client'

import type { InboxDto } from '@notifydesk/shared'

const INBOX: InboxDto = {
  items: [
    {
      id: 'a1b2c3',
      tenantId: 't1',
      recipientId: 'user_42',
      type: 'order.shipped',
      channels: ['in_app'],
      title: '주문 발송',
      body: 'A-1024 발송 완료',
      data: null,
      status: 'sent',
      readAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  unreadCount: 1,
  limit: 20,
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

const PK = 'pk_0123456789abcdef0123456789abcdef'

describe('createNotifyDeskWidgetClient', () => {
  it('getInbox 는 recipientId·limit·publishable 헤더를 구성한다', async () => {
    const fetch = mockFetch(() => jsonResponse(INBOX))
    const client = createNotifyDeskWidgetClient({
      recipientId: 'user_42',
      publishableKey: PK,
      endpoint: 'https://api.example.com/',
      fetch,
    })
    const out = await client.getInbox(20)
    expect(out).toEqual(INBOX)
    const [url, opts] = calls(fetch)[0]!
    expect(url).toBe('https://api.example.com/api/inbox?recipientId=user_42&limit=20')
    const headers = opts?.headers as Record<string, string>
    expect(headers.authorization).toBe(`Bearer ${PK}`)
    expect(headers['x-notifydesk-widget']).toBeDefined()
  })

  it('getUnreadCount 는 recipientId 를 인코딩한다', async () => {
    const fetch = mockFetch(() => jsonResponse({ recipientId: 'a@b', unreadCount: 3 }))
    const client = createNotifyDeskWidgetClient({
      recipientId: 'a@b',
      publishableKey: PK,
      endpoint: 'https://x',
      fetch,
    })
    const out = await client.getUnreadCount()
    expect(out.unreadCount).toBe(3)
    expect(calls(fetch)[0]![0]).toBe('https://x/api/inbox/unread-count?recipientId=a%40b')
  })

  it('markRead 는 ids 를, markAllRead 는 all:true 를 POST 한다', async () => {
    const fetch = mockFetch(() => jsonResponse({ updated: 1, unreadCount: 0 }))
    const client = createNotifyDeskWidgetClient({
      recipientId: 'user_42',
      publishableKey: PK,
      endpoint: 'https://x',
      fetch,
    })
    await client.markRead(['a1b2c3'])
    await client.markAllRead()
    const c = calls(fetch)
    expect(c[0]![0]).toBe('https://x/api/inbox/read')
    expect(c[0]![1]?.method).toBe('POST')
    expect(JSON.parse(c[0]![1]?.body as string)).toEqual({
      recipientId: 'user_42',
      ids: ['a1b2c3'],
    })
    expect(JSON.parse(c[1]![1]?.body as string)).toEqual({ recipientId: 'user_42', all: true })
  })

  it('에러 응답은 NotifyDeskWidgetError(status·message)로 던진다', async () => {
    const fetch = mockFetch(() => jsonResponse({ message: 'forbidden' }, 403))
    const client = createNotifyDeskWidgetClient({
      recipientId: 'user_42',
      publishableKey: PK,
      endpoint: 'https://x',
      fetch,
    })
    await expect(client.getInbox()).rejects.toMatchObject({
      name: 'NotifyDeskWidgetError',
      status: 403,
      message: 'forbidden',
    })
  })

  it('배열 message(nestjs-zod)를 합쳐 보여준다', async () => {
    const fetch = mockFetch(() => jsonResponse({ message: ['a', 'b'] }, 400))
    const client = createNotifyDeskWidgetClient({
      recipientId: 'user_42',
      publishableKey: PK,
      endpoint: 'https://x',
      fetch,
    })
    await expect(client.getInbox()).rejects.toThrow('a, b')
  })

  it('NotifyDeskWidgetError 는 Error 인스턴스다', () => {
    expect(new NotifyDeskWidgetError('m', 1)).toBeInstanceOf(Error)
  })
})
