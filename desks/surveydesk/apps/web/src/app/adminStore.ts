import { create } from 'zustand'

/**
 * 어드민 인증 — SurveyDesk 는 세션/계정 대신 단일 ADMIN_TOKEN 으로 어드민 API 를 보호한다.
 * 토큰을 클라이언트(localStorage)에 보관하고 모든 어드민 요청에 X-Admin-Token 헤더로 싣는다.
 * (포트폴리오 셀프호스팅 모델 — 단일 운영자 가정.)
 */
const STORAGE_KEY = 'sd-admin-token'

function readStored(): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

export interface AdminState {
  token: string
  isAuthed: boolean
  setToken: (t: string) => void
  clear: () => void
}

const initial = readStored()

export const useAdminStore = create<AdminState>((set) => ({
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

/** store 밖(API 클라이언트)에서 현재 토큰을 읽기 위한 헬퍼. */
export function getAdminToken(): string {
  return useAdminStore.getState().token
}
