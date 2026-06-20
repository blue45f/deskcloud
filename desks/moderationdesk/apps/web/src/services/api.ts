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

/** 401/403 이면 자격증명을 즉시 비워 로그인 화면으로 떨어뜨린다. */
function maybeLogout(status: number): void {
  if (status === 401 || status === 403) {
    useAuthStore.getState().clear()
  }
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

function errorMessage(data: unknown, status: number): string {
  const m = (data as { message?: unknown })?.message
  return Array.isArray(m) ? m.join(', ') : String(m ?? `요청에 실패했습니다 (${status})`)
}

async function req<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const url = `${BASE}/api/${path.replace(/^\//, '')}`
  const searchParams = buildSearchParams(query)
  const headers = getAuthHeaders()

  const res = await client(url, {
    method,
    ...(Object.keys(headers).length ? { headers } : {}),
    ...(body !== undefined ? { json: body } : {}),
    ...(searchParams ? { searchParams } : {}),
  })

  maybeLogout(res.status)
  const data = await parseBody(res)
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
  const searchParams = buildSearchParams(query)
  const headers = getAuthHeaders()

  const res = await client(url, {
    method: 'get',
    ...(Object.keys(headers).length ? { headers } : {}),
    ...(searchParams ? { searchParams } : {}),
  })

  maybeLogout(res.status)
  const data = await parseBody(res)
  if (!res.ok) throw new ApiError(errorMessage(data, res.status), res.status, data)
  const totalHeader = res.headers.get('X-Total-Count')
  return { data: data as T, totalCount: totalHeader ? Number(totalHeader) : null }
}

/** 공개(가입) — 인증 헤더 없이 호출. */
async function postPublic<T>(path: string, body?: unknown): Promise<T> {
  const url = `${BASE}/api/${path.replace(/^\//, '')}`
  const res = await client(url, {
    method: 'post',
    ...(body !== undefined ? { json: body } : {}),
  })
  const data = await parseBody(res)
  if (!res.ok) throw new ApiError(errorMessage(data, res.status), res.status, data)
  return data as T
}

export const api = {
  get: <T>(path: string, query?: Query) => req<T>('get', path, undefined, query),
  getWithHeaders,
  post: <T>(path: string, body?: unknown) => req<T>('post', path, body),
  patch: <T>(path: string, body?: unknown) => req<T>('patch', path, body),
  put: <T>(path: string, body?: unknown) => req<T>('put', path, body),
  delete: <T>(path: string) => req<T>('delete', path),
  postPublic,
}
