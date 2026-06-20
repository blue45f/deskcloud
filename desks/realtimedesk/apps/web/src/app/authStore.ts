import { create } from 'zustand'

/**
 * 어드민(테넌트 self-service) 인증 — RealtimeDesk 은 계정/세션 대신 **secret 키(sk_)** 로
 * 어드민 API 를 식별·인증한다(`X-Realtime-Key: sk_…`). sk 는 테넌트를 식별하므로,
 * 로그인 = sk 입력. 가입(signup) 직후에는 pk·sk 를 한 번에 받아 저장한다.
 *
 * 보관: sk 와 (라이브 모니터용) pk 를 localStorage 에 둔다 — 단일 운영자/셀프호스팅 가정의
 * 포트폴리오 모델. 공용 PC 에서는 로그아웃으로 지운다.
 */
const SK_KEY = 'rt-secret-key'
const PK_KEY = 'rt-publishable-key'

function read(key: string): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(key) ?? ''
}

function write(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return
  if (value) localStorage.setItem(key, value)
  else localStorage.removeItem(key)
}

export interface AuthState {
  /** secret 키(sk_…) — 어드민 API 인증·테넌트 식별. */
  secretKey: string
  /** publishable 키(pk_…) — 라이브 모니터(WS 구독·presence)용. 가입/대시보드 로드 시 채움. */
  publishableKey: string
  isAuthed: boolean
  /** sk(+선택적 pk)로 로그인/세션 확립. */
  setKeys: (sk: string, pk?: string) => void
  /** pk 만 갱신(대시보드가 테넌트 DTO 를 받아오면 동기화). */
  setPublishableKey: (pk: string) => void
  clear: () => void
}

const initialSk = read(SK_KEY)
const initialPk = read(PK_KEY)

export const useAuthStore = create<AuthState>((set) => ({
  secretKey: initialSk,
  publishableKey: initialPk,
  isAuthed: initialSk.startsWith('sk_'),
  setKeys: (sk, pk) => {
    const secretKey = sk.trim()
    write(SK_KEY, secretKey)
    if (pk !== undefined) write(PK_KEY, pk.trim())
    set((s) => ({
      secretKey,
      publishableKey: pk !== undefined ? pk.trim() : s.publishableKey,
      isAuthed: secretKey.startsWith('sk_'),
    }))
  },
  setPublishableKey: (pk) => {
    const publishableKey = pk.trim()
    write(PK_KEY, publishableKey)
    set({ publishableKey })
  },
  clear: () => {
    write(SK_KEY, '')
    write(PK_KEY, '')
    set({ secretKey: '', publishableKey: '', isAuthed: false })
  },
}))

/** store 밖(API 클라이언트)에서 현재 sk 를 읽기 위한 헬퍼. */
export function getSecretKey(): string {
  return useAuthStore.getState().secretKey
}
