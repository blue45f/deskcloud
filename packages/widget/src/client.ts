/**
 * AuthDesk 위젯/SDK 클라이언트 — 의존성 0(타입만 @authdesk/shared 에서).
 *
 * publishable(`pk_`) 키로 호출하는 브라우저 안전 경로만 감쌉니다:
 *   register(input) — POST {endpoint}/api/auth/register  (X-Authdesk-Key: pk_…)  → AuthResultDto
 *   login(input)    — POST {endpoint}/api/auth/login                              → AuthResultDto
 *   getSession()    — GET  {endpoint}/api/auth/me      (Authorization: Bearer JWT) → EndUserDto | null
 *   logout()        — POST {endpoint}/api/auth/logout                              → void
 *
 * publishable 키는 브라우저 노출이 안전합니다(가입/로그인만, 사용자 목록/통계는 서버 secret 키).
 * 서버는 Origin 도 테넌트별로 검사합니다. end-user 액세스 토큰(JWT)은 클라이언트가 보관합니다.
 */
import type {
  AuthResultDto,
  EndUserDto,
  LoginInput,
  RegisterInput,
  TrackVisitResultDto,
} from '@authdesk/shared'

export type { AuthResultDto, EndUserDto, LoginInput, RegisterInput, TrackVisitResultDto }

const WIDGET_VERSION = '0.1.0'
const DEFAULT_STORAGE_KEY = 'authdesk.token'
const VID_STORAGE_KEY = 'authdesk.vid'

export interface AuthDeskClientOptions {
  /** publishable 키(`pk_…`). 브라우저 노출 안전. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://auth.example.com' (끝의 / 는 무시). */
  endpoint: string
  /** 커스텀 fetch(SSR/테스트). 기본은 전역 fetch. */
  fetch?: typeof fetch
  /**
   * 액세스 토큰 보관 방식. 기본은 메모리(인스턴스 수명).
   *  - 'local': localStorage(브라우저 새로고침에도 유지)
   *  - 'memory': 인스턴스 메모리(탭 새로고침 시 소실)
   *  - 'none': 보관 안 함(매 호출 토큰 직접 전달 필요 — getSession 등엔 token 인자 사용)
   */
  storage?: 'local' | 'memory' | 'none'
  /** storage='local' 일 때의 키 이름. 기본 'authdesk.token'. */
  storageKey?: string
}

/** AuthDesk API 가 4xx/5xx 를 돌려줄 때 던지는 에러(원본 status·detail 보존). */
export class AuthDeskError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown
  ) {
    super(message)
    this.name = 'AuthDeskError'
  }
}

export interface AuthDeskClient {
  /** end-user 가입 → 사용자 + 토큰. 토큰을 보관소에 저장한다(storage 설정에 따라). */
  register(input: RegisterInput): Promise<AuthResultDto>
  /** end-user 로그인 → 사용자 + 토큰. 토큰을 보관소에 저장한다. */
  login(input: LoginInput): Promise<AuthResultDto>
  /** 현재 토큰으로 사용자 조회. 토큰이 없거나 무효면 null(보관 토큰은 자동 해제). */
  getSession(token?: string): Promise<EndUserDto | null>
  /** 로그아웃 — 서버 세션 폐기 + 보관 토큰 해제. */
  logout(token?: string): Promise<void>
  /** 보관 중인 액세스 토큰(없으면 null). */
  getToken(): string | null
  /** 보관 토큰을 직접 설정(서버 렌더 후 hydrate 등). */
  setToken(token: string | null): void
  /**
   * 방문 핑 — 이 테넌트의 트래픽/고유 방문자를 집계한다(POST /auth/visit). fire-and-forget 의도라
   * 실패 시 조용히 false 를 돌려준다(예외를 던지지 않음 — 가입/로그인 UX 를 방해하지 않게).
   * 영속 vid(localStorage)로 고유 방문자를 근사한다.
   */
  trackVisit(): Promise<TrackVisitResultDto | null>
}

/** 영속 방문자 id 를 읽거나 새로 만든다(고유 방문자 근사용). localStorage 미가용이면 undefined. */
function readOrCreateVid(): string | undefined {
  if (typeof localStorage === 'undefined') return undefined
  try {
    const existing = localStorage.getItem(VID_STORAGE_KEY)
    if (existing) return existing
    const vid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `v_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(VID_STORAGE_KEY, vid)
    return vid
  } catch {
    return undefined
  }
}

function messageFromBody(body: unknown, status: number): string {
  const rec = (body ?? {}) as Record<string, unknown>
  const raw = rec.message ?? rec.error ?? `AuthDesk 요청 실패 (${status})`
  return Array.isArray(raw) ? raw.join(', ') : String(raw)
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** storage 설정에 맞는 토큰 보관소(get/set). 'none' 은 항상 null/no-op. */
function makeTokenStore(opts: AuthDeskClientOptions): {
  get(): string | null
  set(token: string | null): void
} {
  const mode = opts.storage ?? 'memory'
  const key = opts.storageKey ?? DEFAULT_STORAGE_KEY
  if (mode === 'none') {
    return { get: () => null, set: () => undefined }
  }
  const canLocal = mode === 'local' && typeof localStorage !== 'undefined'
  if (canLocal) {
    return {
      get: () => localStorage.getItem(key),
      set: (token) => {
        if (token) localStorage.setItem(key, token)
        else localStorage.removeItem(key)
      },
    }
  }
  // memory(또는 localStorage 미가용 폴백)
  let mem: string | null = null
  return {
    get: () => mem,
    set: (token) => {
      mem = token
    },
  }
}

export function createAuthDeskClient(options: AuthDeskClientOptions): AuthDeskClient {
  const base = options.endpoint.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  const store = makeTokenStore(options)

  async function call<T>(
    path: string,
    init: { method: string; body?: unknown; bearer?: string }
  ): Promise<T> {
    if (!doFetch) {
      throw new AuthDeskError('fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.', 0)
    }
    const headers: Record<string, string> = {
      'x-authdesk-key': options.publishableKey,
      'x-authdesk-widget': WIDGET_VERSION,
    }
    if (init.body !== undefined) headers['content-type'] = 'application/json'
    if (init.bearer) headers.authorization = `Bearer ${init.bearer}`

    const res = await doFetch(`${base}/api/${path}`, {
      method: init.method,
      headers,
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    })
    const text = await res.text()
    const body: unknown = text ? safeJson(text) : null
    if (!res.ok) throw new AuthDeskError(messageFromBody(body, res.status), res.status, body)
    return body as T
  }

  return {
    async register(input) {
      const result = await call<AuthResultDto>('auth/register', { method: 'POST', body: input })
      store.set(result.token)
      return result
    },
    async login(input) {
      const result = await call<AuthResultDto>('auth/login', { method: 'POST', body: input })
      store.set(result.token)
      return result
    },
    async getSession(token) {
      const bearer = token ?? store.get()
      if (!bearer) return null
      try {
        return await call<EndUserDto>('auth/me', { method: 'GET', bearer })
      } catch (err) {
        // 토큰 만료/무효 → 보관 토큰 해제, null 반환(다른 에러는 전파).
        if (err instanceof AuthDeskError && (err.status === 401 || err.status === 403)) {
          if (!token) store.set(null)
          return null
        }
        throw err
      }
    },
    async logout(token) {
      const bearer = token ?? store.get()
      if (bearer) {
        try {
          await call<{ ok: true }>('auth/logout', { method: 'POST', bearer })
        } catch (err) {
          // 이미 무효한 토큰이면 조용히 무시(로그아웃은 멱등 의도).
          if (!(err instanceof AuthDeskError && (err.status === 401 || err.status === 403))) {
            throw err
          }
        }
      }
      if (!token) store.set(null)
    },
    async trackVisit() {
      try {
        const vid = readOrCreateVid()
        return await call<TrackVisitResultDto>('auth/visit', {
          method: 'POST',
          body: vid ? { vid } : {},
        })
      } catch {
        // 방문 집계는 best-effort — 실패(네트워크/스로틀/Origin)해도 위젯 UX 를 막지 않는다.
        return null
      }
    },
    getToken: () => store.get(),
    setToken: (token) => store.set(token),
  }
}
