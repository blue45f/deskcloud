import { create } from 'zustand'

/**
 * 어드민 인증 — CommunityDesk 는 멀티테넌트라 두 가지 자격증명을 지원한다.
 *
 *  - `sk`         : 테넌트 본인의 secret 키(sk_...). `x-sk` 헤더로 싣고 그 테넌트로 스코프.
 *  - `adminToken` : 글로벌 ADMIN_TOKEN(셀프호스트 운영자). `x-admin-token` 헤더로 싣는다.
 *                   특정 테넌트를 보려면 `tenantHint`(tenantId 또는 pk_)를 함께 둔다.
 *
 * 자격증명은 클라이언트(localStorage)에 평문 보관한다(포트폴리오 셀프호스팅 모델).
 */
export type AdminKind = 'sk' | 'adminToken'

const STORAGE_KEY = 'cd-admin-auth'

export interface StoredAuth {
  kind: AdminKind
  value: string
  /** adminToken 모드에서만 — 대상 테넌트(tenantId 또는 pk_...). */
  tenantHint?: string
}

function readStored(): StoredAuth | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredAuth
    if (parsed && typeof parsed.value === 'string' && parsed.value.length > 0) return parsed
    return null
  } catch {
    return null
  }
}

export interface AdminState {
  auth: StoredAuth | null
  isAuthed: boolean
  /** secret 키로 로그인(테넌트 본인). */
  loginWithSecret: (sk: string) => void
  /** 글로벌 ADMIN_TOKEN 으로 로그인(+선택 테넌트 힌트). */
  loginWithAdminToken: (token: string, tenantHint?: string) => void
  clear: () => void
}

function persist(auth: StoredAuth | null): void {
  if (typeof localStorage === 'undefined') return
  if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
  else localStorage.removeItem(STORAGE_KEY)
}

const initial = readStored()

export const useAdminStore = create<AdminState>((set) => ({
  auth: initial,
  isAuthed: initial !== null,
  loginWithSecret: (sk) => {
    const value = sk.trim()
    const auth: StoredAuth | null = value ? { kind: 'sk', value } : null
    persist(auth)
    set({ auth, isAuthed: auth !== null })
  },
  loginWithAdminToken: (token, tenantHint) => {
    const value = token.trim()
    const hint = tenantHint?.trim() || undefined
    const auth: StoredAuth | null = value
      ? { kind: 'adminToken', value, tenantHint: hint }
      : null
    persist(auth)
    set({ auth, isAuthed: auth !== null })
  },
  clear: () => {
    persist(null)
    set({ auth: null, isAuthed: false })
  },
}))

/** store 밖(API 클라이언트)에서 현재 자격증명을 읽기 위한 헬퍼. */
export function getAdminAuth(): StoredAuth | null {
  return useAdminStore.getState().auth
}

/** 현재 자격증명을 어드민 요청 헤더로 변환. */
export function authHeaders(auth: StoredAuth | null): Record<string, string> {
  if (!auth) return {}
  if (auth.kind === 'sk') return { 'x-sk': auth.value }
  const h: Record<string, string> = { 'x-admin-token': auth.value }
  if (auth.tenantHint) {
    // pk_ 면 publishableKey, 아니면 tenantId 로 해석.
    if (auth.tenantHint.startsWith('pk_')) h['x-pk'] = auth.tenantHint
    else h['x-tenant-id'] = auth.tenantHint
  }
  return h
}
