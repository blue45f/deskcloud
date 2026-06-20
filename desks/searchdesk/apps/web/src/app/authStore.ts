import { create } from 'zustand'

/**
 * SearchDesk 어드민 인증 — 두 가지 방식(백엔드 SecretKeyGuard 와 동형):
 *
 *  1) secret 키:  Authorization: Bearer sk_…  → 해당 테넌트로 인증.
 *  2) 어드민 토큰: X-Admin-Token: <ADMIN_TOKEN>  (+ ?tenantId=<대상 테넌트>) → 플랫폼 운영자.
 *
 * 가입(signup) 직후 발급된 키(pk_/sk_)와 테넌트 id 도 함께 보관해, 검색 테스터·임베드
 * 스니펫이 publishable 키를 바로 쓸 수 있게 한다. 모든 값은 이 브라우저(localStorage)에만 저장.
 */
export type AuthVia = 'secret' | 'admin'

const STORAGE_KEY = 'sk-auth'

export interface AuthCreds {
  via: AuthVia
  /** via='secret' 일 때: sk_ 키. */
  secretKey: string
  /** via='admin' 일 때: ADMIN_TOKEN. */
  adminToken: string
  /** via='admin' 일 때 대상 테넌트 id(필수). secret 경로에서도 가입 시 알면 채운다. */
  tenantId: string
  /** 가입/조회로 알게 된 publishable 키(검색 테스터·임베드용, 선택). */
  publishableKey: string
}

const EMPTY: AuthCreds = {
  via: 'secret',
  secretKey: '',
  adminToken: '',
  tenantId: '',
  publishableKey: '',
}

function readStored(): AuthCreds {
  if (typeof localStorage === 'undefined') return { ...EMPTY }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<AuthCreds>
    return { ...EMPTY, ...parsed }
  } catch {
    return { ...EMPTY }
  }
}

function isAuthed(c: AuthCreds): boolean {
  if (c.via === 'secret') return c.secretKey.trim().length > 0
  return c.adminToken.trim().length > 0 && c.tenantId.trim().length > 0
}

function persist(c: AuthCreds): void {
  if (typeof localStorage === 'undefined') return
  if (isAuthed(c)) localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
  else localStorage.removeItem(STORAGE_KEY)
}

export interface AuthState {
  creds: AuthCreds
  isAuthed: boolean
  /** 인증 정보를 설정/병합한다(부분 갱신 가능). */
  setCreds: (patch: Partial<AuthCreds>) => void
  /** 가입/조회로 알게 된 publishable 키만 갱신(인증 상태 유지). */
  setPublishableKey: (pk: string) => void
  clear: () => void
}

const initial = readStored()

export const useAuthStore = create<AuthState>((set, get) => ({
  creds: initial,
  isAuthed: isAuthed(initial),
  setCreds: (patch) => {
    const next = { ...get().creds, ...patch }
    persist(next)
    set({ creds: next, isAuthed: isAuthed(next) })
  },
  setPublishableKey: (pk) => {
    const next = { ...get().creds, publishableKey: pk }
    persist(next)
    set({ creds: next })
  },
  clear: () => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
    set({ creds: { ...EMPTY }, isAuthed: false })
  },
}))

/** store 밖(API 클라이언트)에서 현재 인증 정보를 읽기 위한 헬퍼. */
export function getAuthCreds(): AuthCreds {
  return useAuthStore.getState().creds
}
