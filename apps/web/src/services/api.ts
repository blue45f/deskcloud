import ky from 'ky'

import { getAuthHeaders, useAuthStore } from '@/app/authStore'

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

type Query = Record<string, string | number | undefined>

function buildSearchParams(query?: Query): Record<string, string> | undefined {
  if (!query) return undefined
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)])
  )
}

function parseError(status: number, data: unknown): ApiError {
  const m = (data as { message?: unknown })?.message
  const message = Array.isArray(m) ? m.join(', ') : (m ?? `요청에 실패했습니다 (${status})`)
  return new ApiError(String(message), status, data)
}

/**
 * 어드민 요청 — secret 키(x-sk) 또는 글로벌 토큰(x-admin-token + x-tenant-id)을 자동으로 싣는다.
 * 공개 경로(테넌트 가입)는 auth 헤더가 없어도 통과한다.
 * `auth: false` 로 헤더 주입을 건너뛸 수 있다(공개 가입 POST 등).
 */
async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  query?: Query,
  auth = true
): Promise<T> {
  const url = `${BASE}/api/${path.replace(/^\//, '')}`
  const searchParams = buildSearchParams(query)
  const headers = auth ? getAuthHeaders() : undefined

  const res = await client(url, {
    method,
    ...(headers && Object.keys(headers).length ? { headers } : {}),
    ...(body !== undefined ? { json: body } : {}),
    ...(searchParams ? { searchParams } : {}),
  })

  // 토큰 만료/무효 → 즉시 로그아웃 상태로(공개 가입 호출은 auth=false 라 영향 없음).
  if (auth && (res.status === 401 || res.status === 403)) {
    useAuthStore.getState().clear()
  }

  const text = await res.text()
  const data: unknown = text ? JSON.parse(text) : null
  if (!res.ok) throw parseError(res.status, data)
  return data as T
}

export interface ListResult<T> {
  data: T
  /** 응답 헤더(X-Total-Count 등) — 페이지네이션 토탈을 직접 읽을 때 사용. */
  totalCount: number | null
}

/** 헤더(X-Total-Count)까지 필요한 GET. */
async function getWithHeaders<T>(path: string, query?: Query): Promise<ListResult<T>> {
  const url = `${BASE}/api/${path.replace(/^\//, '')}`
  const searchParams = buildSearchParams(query)
  const headers = getAuthHeaders()
  const res = await client(url, {
    method: 'get',
    ...(Object.keys(headers).length ? { headers } : {}),
    ...(searchParams ? { searchParams } : {}),
  })
  if (res.status === 401 || res.status === 403) {
    useAuthStore.getState().clear()
  }
  const text = await res.text()
  const data: unknown = text ? JSON.parse(text) : null
  if (!res.ok) throw parseError(res.status, data)
  const totalHeader = res.headers.get('X-Total-Count')
  return { data: data as T, totalCount: totalHeader ? Number(totalHeader) : null }
}

export const api = {
  get: <T>(path: string, query?: Query) => req<T>('get', path, undefined, query),
  getWithHeaders,
  post: <T>(path: string, body?: unknown) => req<T>('post', path, body),
  patch: <T>(path: string, body?: unknown) => req<T>('patch', path, body),
  put: <T>(path: string, body?: unknown) => req<T>('put', path, body),
  delete: <T>(path: string) => req<T>('delete', path),
  /** 공개(auth 헤더 없이) POST — 테넌트 셀프 가입 등. */
  postPublic: <T>(path: string, body?: unknown) => req<T>('post', path, body, undefined, false),
}
