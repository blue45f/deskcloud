import { SECRET_KEY_PREFIX } from '@reviewdesk/shared'
import { create } from 'zustand'

/**
 * 어드민 인증 — ReviewDesk 는 멀티테넌트 외부 온보딩이라 두 가지 자격으로 어드민 API 에
 * 접근한다:
 *
 *   1) 테넌트 **secret 키**(sk_...) — SaaS 고객. `x-sk` 헤더로 싣고 그 테넌트로 스코프됨.
 *   2) 글로벌 **ADMIN_TOKEN** — 셀프호스트 운영자(모든 테넌트). `x-admin-token` 헤더로 싣고,
 *      대상 테넌트를 `x-tenant-id`(또는 x-pk)로 별도 지정해야 한다.
 *
 * 자격을 클라이언트(localStorage)에 보관하고 모든 어드민 요청 헤더에 싣는다.
 * 글로벌 토큰 모드에서는 현재 보고 있는 테넌트 id 를 함께 보관한다.
 */
const KEY_STORAGE = 'rd-admin-key'
const KIND_STORAGE = 'rd-admin-kind'
const TENANT_STORAGE = 'rd-admin-tenant'

export type CredentialKind = 'secret' | 'admin'

function readStored(name: string): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(name) ?? ''
}

/** sk_ 로 시작하면 테넌트 secret 키, 아니면 글로벌 ADMIN_TOKEN 으로 간주한다. */
export function inferKind(key: string): CredentialKind {
  return key.trim().startsWith(SECRET_KEY_PREFIX) ? 'secret' : 'admin'
}

export interface AuthState {
  /** 입력된 자격 문자열(secret 키 또는 ADMIN_TOKEN). */
  key: string
  kind: CredentialKind
  /** 글로벌 토큰 모드에서 대상 테넌트 id(secret 모드에서는 무시). */
  tenantId: string
  isAuthed: boolean
  /** 자격을 설정(종류는 접두사로 자동 추론). */
  setKey: (key: string) => void
  /** 글로벌 토큰 모드에서 대상 테넌트 전환. */
  setTenantId: (id: string) => void
  clear: () => void
}

const initialKey = readStored(KEY_STORAGE)
const initialKind = (readStored(KIND_STORAGE) as CredentialKind) || inferKind(initialKey)
const initialTenant = readStored(TENANT_STORAGE)

export const useAuthStore = create<AuthState>((set) => ({
  key: initialKey,
  kind: initialKind,
  tenantId: initialTenant,
  isAuthed: initialKey.length > 0,
  setKey: (raw) => {
    const key = raw.trim()
    const kind = inferKind(key)
    if (typeof localStorage !== 'undefined') {
      if (key) {
        localStorage.setItem(KEY_STORAGE, key)
        localStorage.setItem(KIND_STORAGE, kind)
      } else {
        localStorage.removeItem(KEY_STORAGE)
        localStorage.removeItem(KIND_STORAGE)
      }
    }
    set({ key, kind, isAuthed: key.length > 0 })
  },
  setTenantId: (id) => {
    const tenantId = id.trim()
    if (typeof localStorage !== 'undefined') {
      if (tenantId) localStorage.setItem(TENANT_STORAGE, tenantId)
      else localStorage.removeItem(TENANT_STORAGE)
    }
    set({ tenantId })
  },
  clear: () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(KEY_STORAGE)
      localStorage.removeItem(KIND_STORAGE)
      localStorage.removeItem(TENANT_STORAGE)
    }
    set({ key: '', kind: 'admin', tenantId: '', isAuthed: false })
  },
}))

/** store 밖(API 클라이언트)에서 현재 자격을 읽기 위한 헬퍼. */
export function getAuthHeaders(): Record<string, string> {
  const { key, kind, tenantId } = useAuthStore.getState()
  if (!key) return {}
  if (kind === 'secret') return { 'X-Sk': key }
  // 글로벌 토큰 모드 — 대상 테넌트를 지정해야 한다.
  const headers: Record<string, string> = { 'X-Admin-Token': key }
  if (tenantId) headers['X-Tenant-Id'] = tenantId
  return headers
}
