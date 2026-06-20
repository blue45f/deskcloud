/**
 * @chatdesk/widget/track — 가벼운 방문 ping(fire-and-forget).
 *
 * 위젯이 마운트될 때 호스트의 publishable 키로 `POST /api/tenants/:pk/visit` 를 1회 호출해
 * 어드민 대시보드의 "오늘 방문자 / 총 트래픽" 을 정직하게 집계한다. pk 는 브라우저 안전이고
 * sk 는 절대 쓰지 않는다. 실패해도 채팅 UX 에 영향이 없도록 모든 오류를 삼킨다.
 *
 * visitorId 는 클라이언트가 생성(crypto.randomUUID)해 localStorage 에 보관하는 익명 식별자로,
 * 서버가 (테넌트, 일자, visitorId) 로 고유 방문자를 dedupe 한다.
 */

const STORAGE_KEY = 'chatdesk:visitorId'

/** 안정적인 익명 방문자 id 를 반환(없으면 생성·보관). 비브라우저/스토리지 차단 시 undefined. */
function resolveVisitorId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing) return existing
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `v_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
    window.localStorage.setItem(STORAGE_KEY, id)
    return id
  } catch {
    // 시크릿 모드·스토리지 차단 등 — 고유 방문자 dedupe 없이 pageview 만 집계되게 둔다.
    return undefined
  }
}

/** 같은 마운트에서 중복 ping 을 막기 위한 1회 가드(엔드포인트+키 단위). */
const pinged = new Set<string>()

/**
 * 방문 ping 1회. endpoint 는 위젯의 API 베이스(예: https://chat.example.com), key 는 pk_….
 * fire-and-forget — Promise 를 반환하지만 호출부는 무시해도 된다. 오류는 절대 throw 하지 않는다.
 */
export async function pingVisit(
  endpoint: string,
  publishableKey: string,
  fetchImpl?: typeof fetch
): Promise<void> {
  if (typeof window === 'undefined') return
  if (!endpoint || !publishableKey) return

  const guardKey = `${endpoint}|${publishableKey}`
  if (pinged.has(guardKey)) return
  pinged.add(guardKey)

  const doFetch = fetchImpl ?? globalThis.fetch
  if (!doFetch) return

  const base = endpoint.replace(/\/+$/, '')
  const url = `${base}/api/tenants/${encodeURIComponent(publishableKey)}/visit`
  const visitorId = resolveVisitorId()

  try {
    await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(visitorId ? { visitorId } : {}),
      keepalive: true,
    })
  } catch {
    // 네트워크 오류는 무시 — 트래픽 집계는 best-effort 이며 채팅과 독립적이다.
  }
}
