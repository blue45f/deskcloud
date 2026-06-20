import { describe, expect, it, vi } from 'vitest'

import { AuthDeskError, createAuthDeskClient } from './client'

import type { AuthResultDto, EndUserDto } from '@authdesk/shared'

const USER: EndUserDto = {
  id: 'u1',
  email: 'user@acme.test',
  name: 'Test User',
  verified: false,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const AUTH: AuthResultDto = { user: USER, token: 'jwt.token.value', expiresIn: 3600 }

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

describe('createAuthDeskClient', () => {
  it('register 는 POST /api/auth/register 로 X-Authdesk-Key 와 함께 보낸다', async () => {
    const fetch = mockFetch(() => jsonResponse(AUTH, 201))
    const client = createAuthDeskClient({
      publishableKey: PK,
      endpoint: 'https://auth.example.com/',
      fetch,
      storage: 'memory',
    })
    const out = await client.register({
      email: 'user@acme.test',
      password: 'Hunter2!pw',
      name: 'Test User',
    })
    expect(out).toEqual(AUTH)

    const [url, opts] = calls(fetch)[0]!
    expect(url).toBe('https://auth.example.com/api/auth/register')
    expect(opts?.method).toBe('POST')
    const headers = opts?.headers as Record<string, string>
    expect(headers['x-authdesk-key']).toBe(PK)
    expect(headers['x-authdesk-widget']).toBeDefined()
    expect(headers['content-type']).toBe('application/json')
    // 토큰을 보관한다
    expect(client.getToken()).toBe('jwt.token.value')
  })

  it('login 은 POST /api/auth/login 으로 보내고 토큰을 저장한다', async () => {
    const fetch = mockFetch(() => jsonResponse(AUTH))
    const client = createAuthDeskClient({
      publishableKey: PK,
      endpoint: 'https://x',
      fetch,
      storage: 'memory',
    })
    await client.login({ email: 'user@acme.test', password: 'Hunter2!pw' })
    expect(calls(fetch)[0]![0]).toBe('https://x/api/auth/login')
    expect(client.getToken()).toBe('jwt.token.value')
  })

  it('endpoint 끝 슬래시를 정규화한다', async () => {
    const fetch = mockFetch(() => jsonResponse(AUTH))
    const client = createAuthDeskClient({
      publishableKey: PK,
      endpoint: 'https://x//',
      fetch,
      storage: 'none',
    })
    await client.login({ email: 'a@b.test', password: 'Hunter2!pw' })
    expect(calls(fetch)[0]![0]).toBe('https://x/api/auth/login')
  })

  it('getSession 은 보관 토큰을 Bearer 로 실어 GET /api/auth/me 를 호출한다', async () => {
    const fetch = mockFetch((url) =>
      url.endsWith('/me') ? jsonResponse(USER) : jsonResponse(AUTH)
    )
    const client = createAuthDeskClient({
      publishableKey: PK,
      endpoint: 'https://x',
      fetch,
      storage: 'memory',
    })
    await client.login({ email: 'a@b.test', password: 'Hunter2!pw' })
    const me = await client.getSession()
    expect(me).toEqual(USER)
    const meCall = calls(fetch).find(([u]) => u.endsWith('/me'))!
    expect(meCall[1]?.method).toBe('GET')
    expect((meCall[1]?.headers as Record<string, string>).authorization).toBe(
      'Bearer jwt.token.value'
    )
  })

  it('getSession 은 토큰이 없으면 호출 없이 null', async () => {
    const fetch = mockFetch(() => jsonResponse(USER))
    const client = createAuthDeskClient({
      publishableKey: PK,
      endpoint: 'https://x',
      fetch,
      storage: 'none',
    })
    expect(await client.getSession()).toBeNull()
    expect(calls(fetch)).toHaveLength(0)
  })

  it('getSession 은 401 이면 null + 보관 토큰 해제', async () => {
    const fetch = mockFetch((url) =>
      url.endsWith('/me') ? jsonResponse({ message: 'expired' }, 401) : jsonResponse(AUTH)
    )
    const client = createAuthDeskClient({
      publishableKey: PK,
      endpoint: 'https://x',
      fetch,
      storage: 'memory',
    })
    await client.login({ email: 'a@b.test', password: 'Hunter2!pw' })
    expect(await client.getSession()).toBeNull()
    expect(client.getToken()).toBeNull()
  })

  it('logout 은 POST /api/auth/logout 후 토큰을 비운다', async () => {
    const fetch = mockFetch((url) =>
      url.endsWith('/logout') ? jsonResponse({ ok: true }) : jsonResponse(AUTH)
    )
    const client = createAuthDeskClient({
      publishableKey: PK,
      endpoint: 'https://x',
      fetch,
      storage: 'memory',
    })
    await client.login({ email: 'a@b.test', password: 'Hunter2!pw' })
    await client.logout()
    expect(calls(fetch).some(([u]) => u.endsWith('/api/auth/logout'))).toBe(true)
    expect(client.getToken()).toBeNull()
  })

  it('에러 응답은 AuthDeskError(status·message)로 던진다', async () => {
    const fetch = mockFetch(() => jsonResponse({ message: 'forbidden' }, 403))
    const client = createAuthDeskClient({
      publishableKey: PK,
      endpoint: 'https://x',
      fetch,
      storage: 'none',
    })
    await expect(client.login({ email: 'a@b.test', password: 'x' })).rejects.toMatchObject({
      name: 'AuthDeskError',
      status: 403,
      message: 'forbidden',
    })
  })

  it('배열 message(zod 스타일)를 합쳐 보여준다', async () => {
    const fetch = mockFetch(() =>
      jsonResponse({ message: ['email: invalid', 'password: too short'] }, 400)
    )
    const client = createAuthDeskClient({
      publishableKey: PK,
      endpoint: 'https://x',
      fetch,
      storage: 'none',
    })
    await expect(client.register({ email: 'bad', password: 'x', name: 'n' })).rejects.toThrow(
      'email: invalid, password: too short'
    )
  })

  it('AuthDeskError 는 Error 인스턴스다', () => {
    expect(new AuthDeskError('m', 1)).toBeInstanceOf(Error)
  })

  it('trackVisit 는 POST /api/auth/visit 로 X-Authdesk-Key 와 함께 보낸다', async () => {
    const fetch = mockFetch((url) =>
      url.endsWith('/visit') ? jsonResponse({ ok: true, unique: true }) : jsonResponse(AUTH)
    )
    const client = createAuthDeskClient({
      publishableKey: PK,
      endpoint: 'https://auth.example.com',
      fetch,
      storage: 'none',
    })
    const out = await client.trackVisit()
    expect(out).toEqual({ ok: true, unique: true })

    const [url, opts] = calls(fetch)[0]!
    expect(url).toBe('https://auth.example.com/api/auth/visit')
    expect(opts?.method).toBe('POST')
    expect((opts?.headers as Record<string, string>)['x-authdesk-key']).toBe(PK)
  })

  it('trackVisit 는 실패(스로틀/Origin 등)해도 던지지 않고 null 을 돌려준다', async () => {
    const fetch = mockFetch(() => jsonResponse({ message: 'throttled' }, 429))
    const client = createAuthDeskClient({
      publishableKey: PK,
      endpoint: 'https://x',
      fetch,
      storage: 'none',
    })
    await expect(client.trackVisit()).resolves.toBeNull()
  })
})
