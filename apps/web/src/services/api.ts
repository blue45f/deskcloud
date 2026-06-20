import ky from 'ky'

import { getSecretKey, useAuthStore } from '@/app/authStore'

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

interface ReqOptions {
  /** secret 키(X-Realtime-Key) 를 싣지 않는다(공개 가입 등). 기본 false. */
  anonymous?: boolean
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  query?: Query,
  opts: ReqOptions = {}
): Promise<T> {
  const url = `${BASE}/api/${path.replace(/^\//, '')}`
  const searchParams = query
    ? Object.fromEntries(
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)])
      )
    : undefined

  // 어드민/퍼블리시 요청은 secret 키를 X-Realtime-Key 로 싣는다(테넌트 식별·인증).
  const sk = opts.anonymous ? '' : getSecretKey()
  const headers = sk ? { 'X-Realtime-Key': sk } : undefined

  const res = await client(url, {
    method,
    ...(headers ? { headers } : {}),
    ...(body !== undefined ? { json: body } : {}),
    ...(searchParams ? { searchParams } : {}),
  })

  // 키 만료/무효 → 즉시 로그아웃 상태로 떨어뜨려 로그인 화면을 노출.
  if (!opts.anonymous && (res.status === 401 || res.status === 403)) {
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

export const api = {
  get: <T>(path: string, query?: Query) => req<T>('get', path, undefined, query),
  post: <T>(path: string, body?: unknown) => req<T>('post', path, body),
  /** 인증 헤더 없이(공개 가입 등) POST. */
  postAnonymous: <T>(path: string, body?: unknown) =>
    req<T>('post', path, body, undefined, { anonymous: true }),
  patch: <T>(path: string, body?: unknown) => req<T>('patch', path, body),
  put: <T>(path: string, body?: unknown) => req<T>('put', path, body),
  delete: <T>(path: string) => req<T>('delete', path),
}

/** 라이브 모니터·SDK 가 쓰는 WS/REST 엔드포인트 베이스(프록시 사용 시 빈 문자열 = same-origin). */
export const apiBase = BASE
