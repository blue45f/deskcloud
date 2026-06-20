import ky from 'ky'

import { authHeaders, getAdminAuth, useAdminStore } from '@/app/adminStore'

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

function searchParamsOf(query?: Query): Record<string, string> | undefined {
  return query
    ? Object.fromEntries(
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)])
      )
    : undefined
}

/** 어드민 자격증명을 헤더로(공개 가입 경로는 헤더 없이 호출). */
function adminHeaders(): Record<string, string> | undefined {
  const h = authHeaders(getAdminAuth())
  return Object.keys(h).length > 0 ? h : undefined
}

async function req<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const url = `${BASE}/api/${path.replace(/^\//, '')}`
  const searchParams = searchParamsOf(query)
  const headers = adminHeaders()

  const res = await client(url, {
    method,
    ...(headers ? { headers } : {}),
    ...(body !== undefined ? { json: body } : {}),
    ...(searchParams ? { searchParams } : {}),
  })

  // 토큰 만료/무효 → 즉시 로그아웃 상태로 떨어뜨려 로그인 화면을 노출.
  if (res.status === 401 || res.status === 403) {
    useAdminStore.getState().clear()
  }

  const text = await res.text()
  const data: unknown = text ? JSON.parse(text) : null
  if (!res.ok) {
    const m = (data as { message?: unknown })?.message
    const message = Array.isArray(m) ? m.join(', ') : (m ?? `요청에 실패했습니다 (${res.status})`)
    throw new ApiError(String(message), res.status, data)
  }
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
  const searchParams = searchParamsOf(query)
  const headers = adminHeaders()
  const res = await client(url, {
    method: 'get',
    ...(headers ? { headers } : {}),
    ...(searchParams ? { searchParams } : {}),
  })
  if (res.status === 401 || res.status === 403) {
    useAdminStore.getState().clear()
  }
  const text = await res.text()
  const data: unknown = text ? JSON.parse(text) : null
  if (!res.ok) {
    const m = (data as { message?: unknown })?.message
    const message = Array.isArray(m) ? m.join(', ') : (m ?? `요청에 실패했습니다 (${res.status})`)
    throw new ApiError(String(message), res.status, data)
  }
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

export { BASE as API_BASE }
