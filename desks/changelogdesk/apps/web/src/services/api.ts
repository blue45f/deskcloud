import ky from 'ky'

import { getAuth, useAuthStore } from '@/app/authStore'

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

/**
 * 어드민 인증 헤더를 만든다(authStore 미러):
 *  - secret 모드: `x-sk: sk_…` (그 키의 테넌트가 대상)
 *  - token 모드: `X-Admin-Token: …` + 대상 테넌트가 있으면 `x-tenant-id`
 */
function authHeaders(): Record<string, string> {
  const { credential, mode, tenantId } = getAuth()
  if (!credential) return {}
  if (mode === 'secret') return { 'x-sk': credential }
  const headers: Record<string, string> = { 'X-Admin-Token': credential }
  if (tenantId) headers['x-tenant-id'] = tenantId
  return headers
}

function searchOf(query?: Query): Record<string, string> | undefined {
  if (!query) return undefined
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)])
  )
}

async function handle<T>(res: Response): Promise<T> {
  // 토큰 만료/무효 → 즉시 로그아웃 상태로 떨어뜨려 로그인 화면을 노출.
  if (res.status === 401 || res.status === 403) {
    useAuthStore.getState().clear()
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

/** 어드민 인증을 싣는 요청(대시보드 전용). */
async function req<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const url = `${BASE}/api/${path.replace(/^\//, '')}`
  const headers = authHeaders()
  const searchParams = searchOf(query)
  const res = await client(url, {
    method,
    headers,
    ...(body !== undefined ? { json: body } : {}),
    ...(searchParams ? { searchParams } : {}),
  })
  return handle<T>(res)
}

/** 인증 없는 공개 요청(셀프서브 가입 등). */
async function publicReq<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${BASE}/api/${path.replace(/^\//, '')}`
  const res = await client(url, {
    method,
    ...(body !== undefined ? { json: body } : {}),
  })
  return handle<T>(res)
}

export const api = {
  get: <T>(path: string, query?: Query) => req<T>('get', path, undefined, query),
  post: <T>(path: string, body?: unknown) => req<T>('post', path, body),
  put: <T>(path: string, body?: unknown) => req<T>('put', path, body),
  delete: <T>(path: string) => req<T>('delete', path),
  /** 공개(무인증) POST — 가입 등. */
  publicPost: <T>(path: string, body?: unknown) => publicReq<T>('post', path, body),
}
