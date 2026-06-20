import { describe, expect, it, vi } from 'vitest'

import { createChatAdmin } from './admin'
import { createChatClient } from './client'
import { ChatDeskError, qs } from './rest'

/** fetch 시그니처를 가진 mock — mock.calls 가 [url, init] 튜플로 타입 추론된다. */
function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  return vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(impl)
}

describe('qs', () => {
  it('undefined 값을 생략하고 인코딩한다', () => {
    expect(qs({ memberId: 'alice', limit: 30, before: undefined })).toBe('?memberId=alice&limit=30')
    expect(qs({})).toBe('')
    expect(qs({ a: 'x y' })).toBe('?a=x%20y')
  })
})

describe('createChatClient', () => {
  it('publishableKey/memberId 없으면 던진다', () => {
    expect(() => createChatClient({ publishableKey: '', memberId: 'a', endpoint: 'http://x' })).toThrow(
      ChatDeskError
    )
    expect(() => createChatClient({ publishableKey: 'pk_x', memberId: '', endpoint: 'http://x' })).toThrow(
      ChatDeskError
    )
  })

  it('conversations() 가 pk 헤더와 memberId 쿼리로 REST 를 호출한다', async () => {
    const fetchMock = mockFetch(async () =>
      jsonResponse({ memberId: 'alice', items: [], totalUnread: 0 })
    )
    const chat = createChatClient({
      publishableKey: 'pk_demo',
      memberId: 'alice',
      endpoint: 'http://localhost:4094/',
      fetch: fetchMock as unknown as typeof fetch,
    })
    const res = await chat.conversations()
    expect(res.memberId).toBe('alice')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('http://localhost:4094/api/conversations?memberId=alice')
    expect((init as RequestInit).headers).toMatchObject({ 'x-chat-key': 'pk_demo' })
  })

  it('초기 상태는 idle 이다', () => {
    const chat = createChatClient({ publishableKey: 'pk_x', memberId: 'a', endpoint: 'http://x' })
    expect(chat.state).toBe('idle')
    expect(chat.memberId).toBe('a')
  })

  it('REST 오류를 ChatDeskError 로 감싼다', async () => {
    const fetchMock = mockFetch(async () => jsonResponse({ message: '대화의 멤버가 아닙니다' }, 403))
    const chat = createChatClient({
      publishableKey: 'pk_demo',
      memberId: 'eve',
      endpoint: 'http://x',
      fetch: fetchMock as unknown as typeof fetch,
    })
    await expect(chat.conversations()).rejects.toMatchObject({
      name: 'ChatDeskError',
      status: 403,
      message: '대화의 멤버가 아닙니다',
    })
  })
})

describe('createChatAdmin', () => {
  it('sk 헤더로 대화를 생성한다', async () => {
    const fetchMock = mockFetch(async () =>
      jsonResponse({ id: 'c1', tenantId: 't1', kind: 'dm', title: null, memberIds: ['a', 'b'], createdAt: 'now' })
    )
    const admin = createChatAdmin({
      secretKey: 'sk_demo',
      endpoint: 'http://x',
      fetch: fetchMock as unknown as typeof fetch,
    })
    const conv = await admin.createConversation({ kind: 'dm', memberIds: ['a', 'b'] })
    expect(conv.id).toBe('c1')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('http://x/api/conversations')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).headers).toMatchObject({ 'x-chat-key': 'sk_demo' })
  })

  it('systemSend 가 admin 경로로 POST 한다', async () => {
    const fetchMock = mockFetch(async () => jsonResponse({ message: { id: 'm1' }, delivered: 2 }))
    const admin = createChatAdmin({
      secretKey: 'sk_demo',
      endpoint: 'http://x',
      fetch: fetchMock as unknown as typeof fetch,
    })
    await admin.systemSend('c1', '공지')
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('http://x/api/admin/conversations/c1/system-message')
  })
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
