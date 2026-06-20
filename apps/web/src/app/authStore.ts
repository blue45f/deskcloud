import { SECRET_KEY_PREFIX } from '@changelogdesk/shared'
import { create } from 'zustand'

/**
 * 어드민 인증 — ChangelogDesk 은 두 가지 자격증명을 지원한다(백엔드 AdminAuthGuard 미러):
 *   1) 테넌트 시크릿 키(sk_…) → `x-sk` 헤더. 그 키의 테넌트가 곧 대상.
 *   2) 글로벌 ADMIN_TOKEN(셀프호스트) → `X-Admin-Token` 헤더. 테넌트 비종속이라
 *      대상 테넌트를 `x-tenant-id`(id 또는 slug)로 지정한다.
 *
 * 입력값이 `sk_` 로 시작하면 시크릿 키 모드, 아니면 admin-token 모드로 자동 판별한다.
 * 자격증명은 클라이언트(localStorage)에만 보관한다(셀프호스팅·단일 운영자 모델).
 */
const KEY_STORAGE = 'cd-admin-key'
const TENANT_STORAGE = 'cd-admin-tenant'

export type AuthMode = 'secret' | 'token'

export function modeOf(credential: string): AuthMode {
  return credential.startsWith(SECRET_KEY_PREFIX) ? 'secret' : 'token'
}

function readStored(key: string): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(key) ?? ''
}

export interface AuthState {
  /** 시크릿 키(sk_…) 또는 글로벌 ADMIN_TOKEN. */
  credential: string
  mode: AuthMode
  /** admin-token 모드에서 대상 테넌트(id 또는 slug). secret 모드에선 무시. */
  tenantId: string
  isAuthed: boolean
  /** 로그인 — 자격증명(+ token 모드용 대상 테넌트)을 저장한다. */
  login: (credential: string, tenantId?: string) => void
  clear: () => void
}

const initialCred = readStored(KEY_STORAGE)
const initialTenant = readStored(TENANT_STORAGE)

export const useAuthStore = create<AuthState>((set) => ({
  credential: initialCred,
  mode: modeOf(initialCred),
  tenantId: initialTenant,
  isAuthed: initialCred.length > 0,
  login: (credentialRaw, tenantIdRaw) => {
    const credential = credentialRaw.trim()
    const tenantId = (tenantIdRaw ?? '').trim()
    if (typeof localStorage !== 'undefined') {
      if (credential) localStorage.setItem(KEY_STORAGE, credential)
      else localStorage.removeItem(KEY_STORAGE)
      if (tenantId) localStorage.setItem(TENANT_STORAGE, tenantId)
      else localStorage.removeItem(TENANT_STORAGE)
    }
    set({
      credential,
      mode: modeOf(credential),
      tenantId,
      isAuthed: credential.length > 0,
    })
  },
  clear: () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(KEY_STORAGE)
      localStorage.removeItem(TENANT_STORAGE)
    }
    set({ credential: '', mode: 'token', tenantId: '', isAuthed: false })
  },
}))

/** store 밖(API 클라이언트)에서 현재 자격증명을 읽기 위한 헬퍼. */
export function getAuth(): { credential: string; mode: AuthMode; tenantId: string } {
  const s = useAuthStore.getState()
  return { credential: s.credential, mode: s.mode, tenantId: s.tenantId }
}
