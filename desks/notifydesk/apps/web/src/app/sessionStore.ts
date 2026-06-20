import { create } from 'zustand'

/**
 * 어드민 세션 — NotifyDesk 는 멀티테넌트라 두 가지 인증 경로를 지원한다.
 *
 *  1) secret 키(`sk_…`)  — 테넌트가 자기 secret 키로 로그인. 모든 어드민/발송 요청에
 *     `Authorization: Bearer sk_…` 헤더로 싣는다. (가입 직후 받은 sk 또는 직접 입력)
 *  2) ADMIN_TOKEN        — 플랫폼 운영자 마스터 토큰. `X-Admin-Token` 헤더 + 대상 테넌트
 *     `?tenantId` 쿼리로 동작한다. (tenantId 필수)
 *
 * 세션은 localStorage 에 보존한다(이 브라우저 한정). publishableKey 는 인박스 프리뷰가
 * 위젯(pk_)으로 호출하기 위해 함께 기억한다(가입 시 받거나 /admin/tenant 응답에서 채움).
 */
const STORAGE_KEY = 'nd-session'

export type AuthKind = 'secret' | 'admin'

export interface Session {
  kind: AuthKind
  /** secret 키(sk_…) — kind='secret' 일 때. */
  secretKey: string
  /** 플랫폼 ADMIN_TOKEN — kind='admin' 일 때. */
  adminToken: string
  /** 대상 테넌트 id — kind='admin' 에 필수, secret 에선 선택(표시용). */
  tenantId: string
  /** publishable 키(pk_…) — 인박스 프리뷰용. 알면 저장(없어도 동작). */
  publishableKey: string
}

const EMPTY: Session = {
  kind: 'secret',
  secretKey: '',
  adminToken: '',
  tenantId: '',
  publishableKey: '',
}

function readStored(): Session {
  if (typeof localStorage === 'undefined') return EMPTY
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<Session>
    return { ...EMPTY, ...parsed }
  } catch {
    return EMPTY
  }
}

function isAuthedSession(s: Session): boolean {
  if (s.kind === 'secret') return s.secretKey.length > 0
  return s.adminToken.length > 0 && s.tenantId.length > 0
}

export interface SessionState {
  session: Session
  isAuthed: boolean
  signIn: (s: Partial<Session> & Pick<Session, 'kind'>) => void
  /** publishable 키를 사후 보강(테넌트 조회/가입 응답 등). */
  setPublishableKey: (pk: string) => void
  clear: () => void
}

function persist(s: Session): void {
  if (typeof localStorage === 'undefined') return
  if (isAuthedSession(s)) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  else localStorage.removeItem(STORAGE_KEY)
}

const initial = readStored()

export const useSessionStore = create<SessionState>((set, get) => ({
  session: initial,
  isAuthed: isAuthedSession(initial),
  signIn: (input) => {
    const next: Session = {
      ...EMPTY,
      ...input,
      secretKey: (input.secretKey ?? '').trim(),
      adminToken: (input.adminToken ?? '').trim(),
      tenantId: (input.tenantId ?? '').trim(),
      publishableKey: (input.publishableKey ?? '').trim(),
    }
    persist(next)
    set({ session: next, isAuthed: isAuthedSession(next) })
  },
  setPublishableKey: (pk) => {
    const next = { ...get().session, publishableKey: pk.trim() }
    persist(next)
    set({ session: next })
  },
  clear: () => {
    persist(EMPTY)
    set({ session: EMPTY, isAuthed: false })
  },
}))

/** store 밖(API 클라이언트)에서 현재 세션을 읽기 위한 헬퍼. */
export function getSession(): Session {
  return useSessionStore.getState().session
}

/**
 * 현재 세션이 어드민/발송 요청에 실어야 하는 헤더를 반환.
 * - secret: { Authorization: 'Bearer sk_…' }
 * - admin:  { 'X-Admin-Token': '…' }
 */
export function authHeaders(s: Session = getSession()): Record<string, string> {
  if (s.kind === 'admin' && s.adminToken) return { 'X-Admin-Token': s.adminToken }
  if (s.kind === 'secret' && s.secretKey) return { Authorization: `Bearer ${s.secretKey}` }
  return {}
}

/** admin 토큰 경로는 ?tenantId 쿼리가 필요하다. secret 경로는 불필요. */
export function authQuery(s: Session = getSession()): Record<string, string> {
  if (s.kind === 'admin' && s.tenantId) return { tenantId: s.tenantId }
  return {}
}
