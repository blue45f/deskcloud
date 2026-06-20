import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { pingVisit } from './track'

/** localStorage 최소 스텁 + window 글로벌을 심어 브라우저 경로를 테스트한다. */
function installBrowser(): { store: Map<string, string> } {
  const store = new Map<string, string>()
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  }
  vi.stubGlobal('window', { localStorage })
  vi.stubGlobal('localStorage', localStorage)
  return { store }
}

describe('pingVisit', () => {
  beforeEach(() => {
    installBrowser()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pk·Origin 안전 — /api/tenants/:pk/visit 로 visitorId 를 POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 202 }))
    await pingVisit('https://chat.example.com/', 'pk_abc', fetchMock as unknown as typeof fetch)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://chat.example.com/api/tenants/pk_abc/visit')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string) as { visitorId?: string }
    expect(typeof body.visitorId).toBe('string')
    expect(body.visitorId!.length).toBeGreaterThan(0)
  })

  it('같은 endpoint+pk 는 1회만 ping(중복 가드)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 202 }))
    await pingVisit('https://once.example.com', 'pk_guard', fetchMock as unknown as typeof fetch)
    await pingVisit('https://once.example.com', 'pk_guard', fetchMock as unknown as typeof fetch)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('네트워크 오류는 삼킨다(throw 없음)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    await expect(
      pingVisit('https://err.example.com', 'pk_err', fetchMock as unknown as typeof fetch)
    ).resolves.toBeUndefined()
  })

  it('pk·endpoint 가 비면 호출하지 않는다', async () => {
    const fetchMock = vi.fn()
    await pingVisit('', 'pk_x', fetchMock as unknown as typeof fetch)
    await pingVisit('https://x.example.com', '', fetchMock as unknown as typeof fetch)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
