/**
 * 어드민 세션 — secret 키(sk_)를 localStorage 에 보관하는 최소 스토어(외부 의존 0).
 *
 * 데모/어드민 편의를 위한 클라이언트 보관입니다(운영 secret 키는 서버 보관이 원칙).
 * 구독자 패턴으로 React useSyncExternalStore 와 연결합니다.
 */
const STORAGE_KEY = 'addesk.secretKey'

type Listener = () => void
const listeners = new Set<Listener>()

let current: string | null = readInitial()

function readInitial(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY)
}

function emit(): void {
  for (const l of listeners) l()
}

export const sessionStore = {
  getSecretKey(): string | null {
    return current
  },
  setSecretKey(key: string): void {
    current = key.trim()
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, current)
    emit()
  },
  clear(): void {
    current = null
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
    emit()
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
