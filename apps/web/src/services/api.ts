import { sessionStore } from '@/app/sessionStore'

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

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

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${BASE}/api/${path.replace(/^\//, '')}`, window.location.origin)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    }
  }
  // BASE 가 비어 있으면(프록시) origin 을 떼고 상대 경로로.
  return BASE ? url.toString() : `${url.pathname}${url.search}`
}

async function req<T>(
  method: string,
  path: string,
  opts: { body?: unknown; query?: Query; auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['content-type'] = 'application/json'

  // 어드민 경로는 secret 키를 x-sk 헤더로 싣는다(addesk SecretKeyGuard 계약).
  if (opts.auth !== false) {
    const key = sessionStore.getSecretKey()
    if (key) headers['x-sk'] = key
  }

  const res = await fetch(buildUrl(path, opts.query), {
    method,
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  })

  // 토큰 만료/무효 → 로그아웃 상태로 떨어뜨려 로그인 화면 노출.
  if ((res.status === 401 || res.status === 403) && opts.auth !== false) {
    sessionStore.clear()
  }

  const text = await res.text()
  const data: unknown = text ? JSON.parse(text) : null
  if (!res.ok) {
    const m = (data as { message?: unknown } | null)?.message
    const message = Array.isArray(m) ? m.join(', ') : (m ?? `요청에 실패했습니다 (${res.status})`)
    throw new ApiError(String(message), res.status, data)
  }
  return data as T
}

export const api = {
  get: <T>(path: string, query?: Query, auth = true) => req<T>('GET', path, { query, auth }),
  post: <T>(path: string, body?: unknown, auth = true) => req<T>('POST', path, { body, auth }),
  put: <T>(path: string, body?: unknown, auth = true) => req<T>('PUT', path, { body, auth }),
  delete: <T>(path: string, auth = true) => req<T>('DELETE', path, { auth }),
}
