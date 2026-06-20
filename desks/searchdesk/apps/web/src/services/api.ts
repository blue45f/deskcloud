import ky from 'ky'

import { getAuthCreds, useAuthStore } from '@/app/authStore'

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

const client = ky.create({
  throwHttpErrors: false,
  timeout: 20_000,
})

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

type Query = Record<string, string | number | boolean | undefined>

/**
 * 인증 헤더·쿼리를 만든다(백엔드 SecretKeyGuard 와 동형):
 *  - secret 경로: Authorization: Bearer sk_…
 *  - admin 경로:  X-Admin-Token: <token>  (+ ?tenantId 쿼리)
 */
function authParts(): { headers: Record<string, string>; tenantIdParam?: string } {
  const c = getAuthCreds()
  if (c.via === 'admin') {
    return {
      headers: c.adminToken ? { 'X-Admin-Token': c.adminToken } : {},
      tenantIdParam: c.tenantId || undefined,
    }
  }
  return { headers: c.secretKey ? { Authorization: `Bearer ${c.secretKey}` } : {} }
}

function buildSearchParams(
  query: Query | undefined,
  tenantIdParam?: string
): URLSearchParams | undefined {
  const merged: Query = { ...(query ?? {}) }
  // ADMIN_TOKEN 경로는 대상 테넌트를 ?tenantId 로 지정해야 한다.
  if (tenantIdParam && merged.tenantId === undefined) merged.tenantId = tenantIdParam
  const entries = Object.entries(merged).filter(([, v]) => v !== undefined && v !== '')
  if (entries.length === 0) return undefined
  return new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))
}

interface RawResult {
  status: number
  ok: boolean
  data: unknown
  headers: Headers
}

async function raw(
  method: string,
  path: string,
  body?: unknown,
  query?: Query,
  /** true 면 인증 헤더를 붙이지 않는다(공개 가입 경로). */
  noAuth = false,
  /** true 면 쿠키를 함께 보낸다(공개 방문 추적 — sd_vid 라운드트립). */
  withCredentials = false
): Promise<RawResult> {
  const url = `${BASE}/api/${path.replace(/^\//, '')}`
  const { headers, tenantIdParam } = noAuth
    ? { headers: {} as Record<string, string>, tenantIdParam: undefined }
    : authParts()
  const searchParams = buildSearchParams(query, tenantIdParam)

  const res = await client(url, {
    method,
    headers,
    ...(withCredentials ? { credentials: 'include' as const } : {}),
    ...(body !== undefined ? { json: body } : {}),
    ...(searchParams ? { searchParams } : {}),
  })

  // 토큰 만료/무효 → 즉시 로그아웃 상태로 떨어뜨려 로그인 화면을 노출(공개 경로 제외).
  if (!noAuth && (res.status === 401 || res.status === 403)) {
    useAuthStore.getState().clear()
  }

  const text = await res.text()
  const data: unknown = text ? JSON.parse(text) : null
  return { status: res.status, ok: res.ok, data, headers: res.headers }
}

function unwrap<T>(r: RawResult): T {
  if (!r.ok) {
    const m = (r.data as { message?: unknown })?.message
    const message = Array.isArray(m) ? m.join(', ') : (m ?? `요청에 실패했습니다 (${r.status})`)
    throw new ApiError(String(message), r.status, r.data)
  }
  return r.data as T
}

export interface ListResult<T> {
  data: T
  /** 응답 헤더(X-Total-Count 등) — 페이지네이션 토탈을 직접 읽을 때 사용. */
  totalCount: number | null
}

export const api = {
  get: async <T>(path: string, query?: Query) =>
    unwrap<T>(await raw('get', path, undefined, query)),
  /** 헤더(X-Total-Count)까지 필요한 GET. */
  getWithHeaders: async <T>(path: string, query?: Query): Promise<ListResult<T>> => {
    const r = await raw('get', path, undefined, query)
    const data = unwrap<T>(r)
    const totalHeader = r.headers.get('X-Total-Count')
    return { data, totalCount: totalHeader ? Number(totalHeader) : null }
  },
  post: async <T>(path: string, body?: unknown, query?: Query) =>
    unwrap<T>(await raw('post', path, body, query)),
  put: async <T>(path: string, body?: unknown, query?: Query) =>
    unwrap<T>(await raw('put', path, body, query)),
  delete: async <T>(path: string, query?: Query) =>
    unwrap<T>(await raw('delete', path, undefined, query)),
  /** 공개(무인증) 가입. */
  signup: async <T>(path: string, body?: unknown) =>
    unwrap<T>(await raw('post', path, body, undefined, true)),
  /** 공개(무인증) GET — 플랫폼 현황 등. 인증 헤더 없이 호출. */
  getPublic: async <T>(path: string, query?: Query) =>
    unwrap<T>(await raw('get', path, undefined, query, true)),
  /**
   * 공개(무인증) 방문 핑 — sd_vid 쿠키 라운드트립을 위해 credentials 포함. 비차단·에러 무시.
   * 응답이 204(본문 없음)이므로 결과는 사용하지 않는다.
   */
  trackVisit: async (path: string): Promise<void> => {
    await raw('post', path, undefined, undefined, true, true)
  },
}
