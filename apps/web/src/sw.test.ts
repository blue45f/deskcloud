import { describe, expect, it, vi } from 'vitest'

// public/sw.js 는 모듈이 아닌 서비스워커 스크립트 — 소스를 ?raw 로 읽어 SW 전역(mock)을 주입해 평가한다.
import swSource from '../public/sw.js?raw'

const ORIGIN = 'https://terms.example.com'

type Listener = (event: unknown) => void
type FakeRequest = { method: string; mode: string; url: string }

function createSw() {
  const listeners = new Map<string, Listener>()
  const cache = { put: vi.fn().mockResolvedValue(undefined) }
  const cachesMock = {
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
    open: vi.fn().mockResolvedValue(cache),
    match: vi.fn().mockResolvedValue(undefined),
  }
  const selfMock = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
    location: { origin: ORIGIN },
  }
  const fetchMock = vi.fn()
  // public/sw.js 는 SW 전역을 globalThis.* 로 참조하므로 동일 이름으로 mock 을 주입한다.
  new Function('globalThis', 'caches', 'fetch', swSource)(selfMock, cachesMock, fetchMock)
  return { listeners, self: selfMock, caches: cachesMock, cache, fetch: fetchMock }
}

type Sw = ReturnType<typeof createSw>

/** fetch 이벤트를 디스패치하고 respondWith 에 넘겨진 Promise 를 돌려준다 (미가로채면 undefined). */
function dispatchFetch(sw: Sw, request: FakeRequest): Promise<unknown> | undefined {
  let responded: Promise<unknown> | undefined
  sw.listeners.get('fetch')?.({
    request,
    respondWith: (value: Promise<unknown>) => {
      responded = value
    },
  })
  return responded
}

async function dispatchActivate(sw: Sw): Promise<void> {
  let pending: Promise<unknown> | undefined
  sw.listeners.get('activate')?.({
    waitUntil: (value: Promise<unknown>) => {
      pending = value
    },
  })
  await pending
}

/** respondWith 이후 fire-and-forget cache.put 체인까지 비운다. */
const flushTasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** 현재 CACHE_NAME 을 소스 파싱 대신 동작(캐시 미스 시 open 호출)으로 알아낸다. */
async function resolveCacheName(): Promise<string> {
  const sw = createSw()
  sw.fetch.mockResolvedValue({ ok: true, clone: () => ({}) })
  await dispatchFetch(sw, { method: 'GET', mode: 'no-cors', url: `${ORIGIN}/assets/probe.js` })
  await flushTasks()
  return sw.caches.open.mock.calls[0][0]
}

describe('sw.js (PWA 오프라인 셸)', () => {
  it('activate 가 termsdesk-pwa- 접두 구버전 캐시만 삭제한다 (현재·서드파티 캐시 보존)', async () => {
    const cacheName = await resolveCacheName()
    expect(cacheName).toMatch(/^termsdesk-pwa-v\d+$/)

    const sw = createSw()
    sw.caches.keys.mockResolvedValue(['termsdesk-pwa-v0', cacheName, 'third-party-cache'])
    await dispatchActivate(sw)

    expect(sw.caches.delete.mock.calls.map(([key]) => key)).toEqual(['termsdesk-pwa-v0'])
    expect(sw.self.clients.claim).toHaveBeenCalledTimes(1)
  })

  it('/assets/ GET 캐시 히트는 네트워크 없이 캐시 응답을 돌려준다', async () => {
    const sw = createSw()
    const cached = { ok: true }
    sw.caches.match.mockResolvedValue(cached)

    const responded = dispatchFetch(sw, {
      method: 'GET',
      mode: 'no-cors',
      url: `${ORIGIN}/assets/index-Ck3x9A.js`,
    })

    await expect(responded).resolves.toBe(cached)
    expect(sw.fetch).not.toHaveBeenCalled()
  })

  it('/assets/ 캐시 미스는 네트워크 응답을 돌려주고 정상(ok) 응답만 캐시에 저장한다', async () => {
    const sw = createSw()
    const copy = {}
    const response = { ok: true, clone: () => copy }
    sw.fetch.mockResolvedValue(response)
    const request = { method: 'GET', mode: 'no-cors', url: `${ORIGIN}/assets/index-Ck3x9A.js` }

    await expect(dispatchFetch(sw, request)).resolves.toBe(response)
    await flushTasks()

    expect(sw.cache.put).toHaveBeenCalledWith(request, copy)
  })

  it('/assets/ 오류 응답(!ok)은 반환하되 캐시에 저장하지 않는다', async () => {
    const sw = createSw()
    const response = { ok: false, clone: vi.fn() }
    sw.fetch.mockResolvedValue(response)

    const responded = dispatchFetch(sw, {
      method: 'GET',
      mode: 'no-cors',
      url: `${ORIGIN}/assets/missing.js`,
    })

    await expect(responded).resolves.toBe(response)
    await flushTasks()

    expect(response.clone).not.toHaveBeenCalled()
    expect(sw.cache.put).not.toHaveBeenCalled()
  })

  it('교차 출처·비GET·/assets/ 밖 GET(API 등)은 가로채지 않는다', () => {
    const sw = createSw()

    const crossOrigin = {
      method: 'GET',
      mode: 'no-cors',
      url: 'https://cdn.example.net/assets/vendor.js',
    }
    const nonGet = { method: 'POST', mode: 'cors', url: `${ORIGIN}/assets/upload` }
    const apiGet = { method: 'GET', mode: 'cors', url: `${ORIGIN}/api/public/terms` }

    expect(dispatchFetch(sw, crossOrigin)).toBeUndefined()
    expect(dispatchFetch(sw, nonGet)).toBeUndefined()
    expect(dispatchFetch(sw, apiGet)).toBeUndefined()
    expect(sw.fetch).not.toHaveBeenCalled()
  })

  it('내비게이션 오프라인 시 캐시된 페이지 → 없으면 / 셸로 폴백한다', async () => {
    const shell = { ok: true }
    const page = { ok: true }
    const request = { method: 'GET', mode: 'navigate', url: `${ORIGIN}/p/acme/terms-of-service` }

    const missed = createSw()
    missed.fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    missed.caches.match.mockImplementation((target: unknown) =>
      Promise.resolve(target === '/' ? shell : undefined)
    )
    await expect(dispatchFetch(missed, request)).resolves.toBe(shell)

    const visited = createSw()
    visited.fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    visited.caches.match.mockImplementation((target: unknown) =>
      Promise.resolve(target === request ? page : target === '/' ? shell : undefined)
    )
    await expect(dispatchFetch(visited, request)).resolves.toBe(page)
  })
})
