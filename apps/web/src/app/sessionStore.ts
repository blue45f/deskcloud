import { create } from 'zustand'

/**
 * 테넌트 세션 — DeskCloud 는 비밀번호 대신 테넌트의 **secret 키(sk_…)** 를 Bearer 로 보내
 * 빌링/계정 API 를 인증한다(가입 응답·시드 로그에서 얻은 평문). 키를 클라이언트(localStorage)에
 * 보관하고, 모든 보호 요청에 `Authorization: Bearer …` 로 싣는다.
 *
 * 주의: secret 키는 서버 전용 시크릿이다. 실제 운영에서는 BFF/세션 쿠키로 가려야 하지만,
 * 여기서는 단일 운영자 데모(surveydesk adminStore 와 동일한 단순 모델)다.
 */
const STORAGE_KEY = 'dc-tenant-token'

function readStored(): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

export interface SessionState {
  /** Bearer 토큰(테넌트 secret 키). */
  token: string
  isAuthed: boolean
  setToken: (t: string) => void
  clear: () => void
}

const initial = readStored()

export const useSessionStore = create<SessionState>((set) => ({
  token: initial,
  isAuthed: initial.length > 0,
  setToken: (t) => {
    const token = t.trim()
    if (typeof localStorage !== 'undefined') {
      if (token) localStorage.setItem(STORAGE_KEY, token)
      else localStorage.removeItem(STORAGE_KEY)
    }
    set({ token, isAuthed: token.length > 0 })
  },
  clear: () => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
    set({ token: '', isAuthed: false })
  },
}))

/** store 밖(API 클라이언트)에서 현재 토큰을 읽는 헬퍼. */
export function getSessionToken(): string {
  return useSessionStore.getState().token
}
