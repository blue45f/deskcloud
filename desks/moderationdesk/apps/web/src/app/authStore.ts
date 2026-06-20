import { create } from 'zustand'

/**
 * 어드민 인증 — ModerationDesk 는 두 가지 자격증명을 지원한다.
 *   1) 테넌트 SECRET 키(sk_...)  → 요청에 `x-sk` 헤더. 자기 테넌트만.
 *   2) 글로벌 ADMIN_TOKEN        → 요청에 `X-Admin-Token` 헤더. 모든 테넌트(셀프호스트 운영자).
 *      이 모드에서는 대상 테넌트를 명시해야 하므로, 대상 테넌트의 publishable 키(pk_...)를
 *      함께 저장하고 `x-pk` 로 싣는다(SecretKeyGuard 가 pk 로 테넌트를 해소).
 *
 * 자격증명은 클라이언트(localStorage)에 보관한다(포트폴리오 셀프호스팅/단일 운영자 가정).
 */
export type CredentialKind = 'sk' | 'admin'

const KEY_KIND = 'md-auth-kind'
const KEY_SECRET = 'md-auth-secret'
const KEY_TENANT_PK = 'md-auth-tenant-pk'

function ls(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage
}

export interface AuthState {
  kind: CredentialKind
  /** sk 모드면 sk_..., admin 모드면 글로벌 ADMIN_TOKEN. */
  secret: string
  /** admin 모드에서 대상 테넌트의 publishable 키(pk_...). sk 모드에선 빈 문자열. */
  tenantPk: string
  isAuthed: boolean
  login: (input: { kind: CredentialKind; secret: string; tenantPk?: string }) => void
  /** admin 모드에서 대상 테넌트만 전환. */
  setTenantPk: (pk: string) => void
  clear: () => void
}

function readInitial(): Pick<AuthState, 'kind' | 'secret' | 'tenantPk' | 'isAuthed'> {
  const store = ls()
  const kind = (store?.getItem(KEY_KIND) as CredentialKind | null) ?? 'sk'
  const secret = store?.getItem(KEY_SECRET) ?? ''
  const tenantPk = store?.getItem(KEY_TENANT_PK) ?? ''
  return { kind, secret, tenantPk, isAuthed: secret.length > 0 }
}

const initial = readInitial()

export const useAuthStore = create<AuthState>((set, get) => ({
  ...initial,
  login: ({ kind, secret, tenantPk }) => {
    const s = secret.trim()
    const pk = (tenantPk ?? '').trim()
    const store = ls()
    if (store) {
      if (s) {
        store.setItem(KEY_KIND, kind)
        store.setItem(KEY_SECRET, s)
        store.setItem(KEY_TENANT_PK, kind === 'admin' ? pk : '')
      } else {
        store.removeItem(KEY_KIND)
        store.removeItem(KEY_SECRET)
        store.removeItem(KEY_TENANT_PK)
      }
    }
    set({ kind, secret: s, tenantPk: kind === 'admin' ? pk : '', isAuthed: s.length > 0 })
  },
  setTenantPk: (raw) => {
    const pk = raw.trim()
    if (get().kind !== 'admin') return
    ls()?.setItem(KEY_TENANT_PK, pk)
    set({ tenantPk: pk })
  },
  clear: () => {
    const store = ls()
    store?.removeItem(KEY_KIND)
    store?.removeItem(KEY_SECRET)
    store?.removeItem(KEY_TENANT_PK)
    set({ kind: 'sk', secret: '', tenantPk: '', isAuthed: false })
  },
}))

/** store 밖(API 클라이언트)에서 현재 인증 헤더를 만들기 위한 헬퍼. */
export function getAuthHeaders(): Record<string, string> {
  const { kind, secret, tenantPk } = useAuthStore.getState()
  if (!secret) return {}
  if (kind === 'admin') {
    const headers: Record<string, string> = { 'X-Admin-Token': secret }
    // 대상 테넌트 지정 — pk 가 있으면 x-pk 로(SecretKeyGuard 가 pk→테넌트 해소).
    if (tenantPk) headers['x-pk'] = tenantPk
    return headers
  }
  return { 'x-sk': secret }
}
