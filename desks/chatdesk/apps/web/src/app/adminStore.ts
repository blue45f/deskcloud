import { create } from 'zustand'

/**
 * 어드민 인증 — ChatDesk 어드민 API 는 테넌트 식별을 위해 **secret 키(sk_…)** 가 필요하다.
 * (전역 X-Admin-Token 만으로는 어떤 테넌트인지 알 수 없어 401.) 그래서 대시보드는
 * 로그인 시 sk 를 받아 `X-Chat-Key` 헤더로 모든 어드민 요청에 싣는다.
 *
 * 선택적으로 전역 ADMIN_TOKEN 도 보관해, 운영자가 회전 등 전역 작업에 함께 보낼 수 있다.
 * 키는 이 브라우저(localStorage)에만 저장한다 — 포트폴리오 셀프서브/셀프호스팅 모델.
 */
const SK_KEY = 'cd-secret-key'
const ADMIN_KEY = 'cd-admin-token'

function readStored(key: string): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(key) ?? ''
}

export interface AdminState {
  /** 테넌트 secret 키(sk_…) — 어드민 식별·인증의 1차 수단. */
  secretKey: string
  /** 전역 ADMIN_TOKEN(선택). */
  adminToken: string
  /** sk 가 있으면 로그인 상태(테넌트 컨텍스트 확보). */
  isAuthed: boolean
  /** sk(+선택 adminToken) 저장. sk 가 비면 로그아웃. */
  login: (secretKey: string, adminToken?: string) => void
  clear: () => void
}

const initialSk = readStored(SK_KEY)
const initialAdmin = readStored(ADMIN_KEY)

export const useAdminStore = create<AdminState>((set) => ({
  secretKey: initialSk,
  adminToken: initialAdmin,
  isAuthed: initialSk.length > 0,
  login: (rawSk, rawAdmin) => {
    const secretKey = rawSk.trim()
    const adminToken = (rawAdmin ?? '').trim()
    if (typeof localStorage !== 'undefined') {
      if (secretKey) localStorage.setItem(SK_KEY, secretKey)
      else localStorage.removeItem(SK_KEY)
      if (adminToken) localStorage.setItem(ADMIN_KEY, adminToken)
      else localStorage.removeItem(ADMIN_KEY)
    }
    set({ secretKey, adminToken, isAuthed: secretKey.length > 0 })
  },
  clear: () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SK_KEY)
      localStorage.removeItem(ADMIN_KEY)
    }
    set({ secretKey: '', adminToken: '', isAuthed: false })
  },
}))

/** store 밖(API 클라이언트)에서 현재 자격을 읽기 위한 헬퍼. */
export function getAuthHeaders(): Record<string, string> {
  const { secretKey, adminToken } = useAdminStore.getState()
  const headers: Record<string, string> = {}
  if (secretKey) headers['X-Chat-Key'] = secretKey
  if (adminToken) headers['X-Admin-Token'] = adminToken
  return headers
}
