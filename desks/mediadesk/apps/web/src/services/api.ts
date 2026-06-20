import ky from 'ky'

import { getAuthHeaders, useSessionStore } from '@/app/sessionStore'

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

async function req<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const url = `${BASE}/api/${path.replace(/^\//, '')}`
  const headers = getAuthHeaders()

  const res = await client(url, {
    method,
    headers,
    ...(body !== undefined ? { json: body } : {}),
    ...(query ? { searchParams: buildSearchParams(query) } : {}),
  })

  // 토큰 만료/무효 → 즉시 로그아웃 상태로 떨어뜨려 로그인 화면을 노출.
  if (res.status === 401 || res.status === 403) {
    useSessionStore.getState().clear()
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

export const api = {
  get: <T>(path: string, query?: Query) => req<T>('get', path, undefined, query),
  post: <T>(path: string, body?: unknown) => req<T>('post', path, body),
  patch: <T>(path: string, body?: unknown) => req<T>('patch', path, body),
  put: <T>(path: string, body?: unknown) => req<T>('put', path, body),
  delete: <T>(path: string) => req<T>('delete', path),
}

/** 위젯/공개 URL 에 쓸 API endpoint(절대 베이스). 비면 같은 origin. */
export function apiEndpoint(): string {
  return BASE || (typeof window !== 'undefined' ? window.location.origin : '')
}
