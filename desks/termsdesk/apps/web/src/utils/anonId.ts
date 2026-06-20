/**
 * 디바이스 익명 식별자 — 로그인 없이 "읽음" 상태(변경 이력 미확인 배지 등)를
 * 디바이스 단위로 기억하기 위한 안정적 ID. localStorage 차단 시 메모리 폴백.
 */
const ANON_STORAGE_KEY = 'td-anon-id'
let memoryFallback: string | null = null

function randomId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function getAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_STORAGE_KEY)
    if (existing) return existing
    const created = randomId()
    localStorage.setItem(ANON_STORAGE_KEY, created)
    return created
  } catch {
    // 스토리지 차단(프라이빗 모드 등) → 세션 메모리 폴백
    memoryFallback ??= randomId()
    return memoryFallback
  }
}
