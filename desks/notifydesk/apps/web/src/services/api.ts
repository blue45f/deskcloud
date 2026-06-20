import ky from 'ky'

import { authHeaders, authQuery, useSessionStore } from '@/app/sessionStore'

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

/** 세션 인증 헤더(secret: Bearer / admin: X-Admin-Token)를 병합한다. */
function buildHeaders(): Record<string, string> | undefined {
  const h = authHeaders()
  return Object.keys(h).length > 0 ? h : undefined
}

/** admin 토큰 세션이면 모든 요청에 ?tenantId 를 자동으로 붙인다. */
function mergeQuery(query?: Query): Query | undefined {
  const aq = authQuery()
  if (Object.keys(aq).length === 0) return query
  return { ...query, ...aq }
}

function toSearchParams(query?: Query): Record<string, string> | undefined {
  if (!query) return undefined
  const entries = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => [k, String(v)] as const)
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

function errorMessage(data: unknown, status: number): string {
  const m = (data as { message?: unknown })?.message
  if (Array.isArray(m)) return m.join(', ')
  return m != null ? String(m) : `요청에 실패했습니다 (${status})`
}

async function req<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const url = `${BASE}/api/${path.replace(/^\//, '')}`
  const searchParams = toSearchParams(mergeQuery(query))
  const headers = buildHeaders()

  const res = await client(url, {
    method,
    ...(headers ? { headers } : {}),
    ...(body !== undefined ? { json: body } : {}),
    ...(searchParams ? { searchParams } : {}),
  })

  // 세션 만료/무효 → 즉시 로그아웃 상태로 떨어뜨려 로그인 화면을 노출.
  if (res.status === 401 || res.status === 403) {
    useSessionStore.getState().clear()
  }

  const data = await readBody(res)
  if (!res.ok) throw new ApiError(errorMessage(data, res.status), res.status, data)
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
  const searchParams = toSearchParams(mergeQuery(query))
  const headers = buildHeaders()

  const res = await client(url, {
    method: 'get',
    ...(headers ? { headers } : {}),
    ...(searchParams ? { searchParams } : {}),
  })
  if (res.status === 401 || res.status === 403) {
    useSessionStore.getState().clear()
  }
  const data = await readBody(res)
  if (!res.ok) throw new ApiError(errorMessage(data, res.status), res.status, data)
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
}

/** API 베이스 URL(스니펫·위젯에서 사용). 빈 문자열이면 현재 origin. */
export function apiBaseUrl(): string {
  return BASE || window.location.origin
}
