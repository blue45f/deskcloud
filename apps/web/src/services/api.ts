import ky from 'ky'

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

const client = ky.create({
  credentials: 'include',
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

async function req<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const url = apiUrl(path)
  const searchParams = query
    ? Object.fromEntries(
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)])
      )
    : undefined

  const res = await client(url, {
    method,
    ...(body !== undefined ? { json: body } : {}),
    ...(searchParams ? { searchParams } : {}),
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

async function formReq<T>(method: string, path: string, body: FormData): Promise<T> {
  const res = await client(apiUrl(path), {
    method,
    body,
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

export function apiUrl(path: string): string {
  return `${BASE}/api/${path.replace(/^\//, '')}`
}

export const api = {
  get: <T>(path: string, query?: Query) => req<T>('get', path, undefined, query),
  post: <T>(path: string, body?: unknown) => req<T>('post', path, body),
  postForm: <T>(path: string, body: FormData) => formReq<T>('post', path, body),
  patch: <T>(path: string, body?: unknown) => req<T>('patch', path, body),
  put: <T>(path: string, body?: unknown) => req<T>('put', path, body),
  delete: <T>(path: string) => req<T>('delete', path),
}
