const CACHE_PREFIX = 'termsdesk-pwa-'
const CACHE_NAME = `${CACHE_PREFIX}v2`
const SCOPE_PATH = new URL(
  globalThis.registration?.scope ?? '/',
  globalThis.location.origin
).pathname.replace(/\/$/, '')
const scopePath = SCOPE_PATH === '/' ? '' : SCOPE_PATH
const scopedPath = (path) => `${scopePath}${path}`

globalThis.addEventListener('install', () => {
  globalThis.skipWaiting()
})

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => globalThis.clients.claim())
  )
})

globalThis.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => {})
          return response
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(scopedPath('/')))
        )
    )
    return
  }

  // 해시 번들(/assets/*)은 파일명이 불변이라 cache-first 가 안전.
  // 오프라인 폴백 시 index.html 이 참조하는 JS/CSS 를 복원하기 위한 셸 캐시.
  const url = new URL(request.url)
  if (
    request.method === 'GET' &&
    url.origin === globalThis.location.origin &&
    url.pathname.startsWith(scopedPath('/assets/'))
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, copy))
                .catch(() => {})
            }
            return response
          })
      )
    )
  }
})
