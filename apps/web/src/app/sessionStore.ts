import { create } from 'zustand'

/**
 * 어드민 세션 — MediaDesk 는 테넌트가 secret 키(sk_) 또는 마스터 ADMIN_TOKEN 으로 로그인한다.
 *
 * - secretKey: 어드민 요청의 `X-Sk` 헤더(또는 빈값이면 adminToken 으로 `X-Admin-Token`).
 * - adminToken: 마스터 토큰 로그인 시. (둘 중 하나만 채워진다.)
 * - publishableKey / tenantSlug: 자산 라이브러리 위젯 업로드·갤러리에 필요(가입/me 응답으로 채움).
 *
 * 모두 이 브라우저 localStorage 에만 보관한다(단일 운영자 가정 · 포트폴리오).
 */
const SK_KEY = 'md-secret-key'
const ADMIN_KEY = 'md-admin-token'
const PK_KEY = 'md-publishable-key'
const SLUG_KEY = 'md-tenant-slug'

function read(key: string): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(key) ?? ''
}

function write(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return
  if (value) localStorage.setItem(key, value)
  else localStorage.removeItem(key)
}

export interface SessionState {
  /** 테넌트 secret 키(sk_). */
  secretKey: string
  /** 마스터 어드민 토큰(있으면). */
  adminToken: string
  /** 현재 테넌트 publishable 키(위젯용). */
  publishableKey: string
  /** 현재 테넌트 slug(공개 자산 경로). */
  tenantSlug: string
  /** 인증 자격이 하나라도 있는지. */
  isAuthed: boolean

  loginWithSecret: (sk: string) => void
  loginWithAdminToken: (token: string) => void
  /** 가입/조회 후 테넌트 공개 정보 갱신(위젯에 필요). */
  setTenant: (info: { publishableKey?: string; tenantSlug?: string }) => void
  clear: () => void
}

const initialSecret = read(SK_KEY)
const initialAdmin = read(ADMIN_KEY)

export const useSessionStore = create<SessionState>((set, get) => ({
  secretKey: initialSecret,
  adminToken: initialAdmin,
  publishableKey: read(PK_KEY),
  tenantSlug: read(SLUG_KEY),
  isAuthed: initialSecret.length > 0 || initialAdmin.length > 0,

  loginWithSecret: (sk) => {
    const secretKey = sk.trim()
    write(SK_KEY, secretKey)
    write(ADMIN_KEY, '')
    set({ secretKey, adminToken: '', isAuthed: secretKey.length > 0 })
  },

  loginWithAdminToken: (token) => {
    const adminToken = token.trim()
    write(ADMIN_KEY, adminToken)
    write(SK_KEY, '')
    set({ adminToken, secretKey: '', isAuthed: adminToken.length > 0 })
  },

  setTenant: ({ publishableKey, tenantSlug }) => {
    const next: Partial<SessionState> = {}
    if (publishableKey !== undefined) {
      write(PK_KEY, publishableKey)
      next.publishableKey = publishableKey
    }
    if (tenantSlug !== undefined) {
      write(SLUG_KEY, tenantSlug)
      next.tenantSlug = tenantSlug
    }
    set({ ...get(), ...next })
  },

  clear: () => {
    write(SK_KEY, '')
    write(ADMIN_KEY, '')
    write(PK_KEY, '')
    write(SLUG_KEY, '')
    set({ secretKey: '', adminToken: '', publishableKey: '', tenantSlug: '', isAuthed: false })
  },
}))

/** store 밖(API 클라이언트)에서 현재 인증 헤더를 구성하기 위한 헬퍼. */
export function getAuthHeaders(): Record<string, string> {
  const { secretKey, adminToken } = useSessionStore.getState()
  if (secretKey) return { 'X-Sk': secretKey }
  if (adminToken) return { 'X-Admin-Token': adminToken }
  return {}
}
