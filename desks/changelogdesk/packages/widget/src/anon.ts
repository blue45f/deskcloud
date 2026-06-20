/**
 * 익명 디바이스 식별자(anonId) — 미읽음 배지/읽음 표시의 기준.
 * localStorage 에 1회 생성·영속한다. 비브라우저/스토리지 차단 환경에서는
 * 세션 메모리 폴백(배지는 동작하지만 새로고침마다 초기화).
 */
const STORAGE_KEY = 'changelogdesk:anonId'

let memoryFallback: string | null = null

function randomId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // 폴백 — UUID 가 없으면 충돌 가능성 낮은 무작위 문자열.
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function getAnonId(): string {
  if (typeof localStorage !== 'undefined') {
    try {
      const existing = localStorage.getItem(STORAGE_KEY)
      if (existing) return existing
      const created = randomId()
      localStorage.setItem(STORAGE_KEY, created)
      return created
    } catch {
      // 스토리지 차단(프라이빗 모드 등) → 메모리 폴백
    }
  }
  if (!memoryFallback) memoryFallback = randomId()
  return memoryFallback
}
