// AIDigestDesk 서비스 워커 — 최소 오프라인 셸 캐시(설치 가능 PWA).
// 정적 SPA이므로 네트워크 우선 + 셸 폴백 전략으로 단순하게 둔다.
// 캐시 버전을 올리면 이전 캐시는 activate에서 정리된다.

const CACHE = 'aidigestdesk-shell-v2'
const SHELL = ['/', '/index.html', '/favicon.svg', '/icon.svg', '/manifest.webmanifest']

function isSameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin
  } catch {
    return false
  }
}

function cacheResponse(cacheKey, response) {
  if (!response.ok || response.type !== 'basic') return
  caches
    .open(CACHE)
    .then((cache) => cache.put(cacheKey, response.clone()))
    .catch(() => {
      // 캐시 쓰기 실패는 비치명적이다. 다음 요청에서 네트워크를 다시 시도한다.
    })
}

async function shellFallback() {
  const cached = await caches.match('/index.html')
  if (cached) return cached

  return new Response(
    '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AIDigestDesk</title></head><body><p>오프라인 상태입니다. 네트워크 연결 후 다시 시도해 주세요.</p></body></html>',
    {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  )
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)
    cacheResponse('/index.html', response)
    return response
  } catch {
    return shellFallback()
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    cacheResponse(request, response)
    return response
  } catch {
    const acceptsHtml = request.headers.get('accept')?.includes('text/html') ?? false
    if (request.destination === 'document' || acceptsHtml) return shellFallback()
    return new Response('', { status: 504, statusText: 'Offline' })
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || !isSameOrigin(request)) return

  // 내비게이션 요청: 네트워크 우선, 실패 시 캐시된 셸로 폴백(SPA 라우팅 유지).
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  // 정적 자산: 캐시 우선, 없으면 네트워크 후 캐시.
  event.respondWith(cacheFirstAsset(request))
})
