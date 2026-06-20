import ky from 'ky'

import { getAuthHeaders, useAdminStore } from '@/app/adminStore'

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

function searchFrom(query?: Query): Record<string, string> | undefined {
  if (!query) return undefined
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)])
  )
}

async function req<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const url = `${BASE}/api/${path.replace(/^\//, '')}`
  const searchParams = searchFrom(query)

  // 어드민 자격(X-Chat-Key: sk_… + 선택 X-Admin-Token)을 모든 요청에 싣는다.
  const headers = getAuthHeaders()
  const hasHeaders = Object.keys(headers).length > 0

  const res = await client(url, {
    method,
    ...(hasHeaders ? { headers } : {}),
    ...(body !== undefined ? { json: body } : {}),
    ...(searchParams ? { searchParams } : {}),
  })

  // 키 만료/무효 → 즉시 로그아웃 상태로 떨어뜨려 로그인 화면을 노출.
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

export const api = {
  get: <T>(path: string, query?: Query) => req<T>('get', path, undefined, query),
  post: <T>(path: string, body?: unknown) => req<T>('post', path, body),
  put: <T>(path: string, body?: unknown) => req<T>('put', path, body),
  delete: <T>(path: string) => req<T>('delete', path),
}

/** 어드민 자격 없이(공개) 호출하는 가입 등 — 예: 테넌트 가입(pk·sk 발급). */
export async function postPublic<T>(path: string, body?: unknown): Promise<T> {
  const url = `${BASE}/api/${path.replace(/^\//, '')}`
  const res = await client(url, {
    method: 'post',
    ...(body !== undefined ? { json: body } : {}),
  })
  const text = await res.text()
  const data: unknown = text ? JSON.parse(text) : null
  if (!res.ok) {
    const m = (data as { message?: unknown })?.message
    const message = Array.isArray(m) ? m.join(', ') : (m ?? `요청에 실패했습니다 (${res.status})`)
    throw new ApiError(String(message), res.status, data)
  }
  return data as T
}

/** 위젯·SDK 가 붙을 공개 API 베이스 URL(스니펫·연결에 사용). 빌드타임 VITE 값 또는 현재 오리진. */
export function publicEndpoint(): string {
  return BASE || (typeof window !== 'undefined' ? window.location.origin : '')
}
