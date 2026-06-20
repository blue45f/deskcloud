/**
 * 공용 HTTP 헬퍼 — 의존성 0. 브라우저(pk) 클라이언트와 서버(sk) 어드민 헬퍼가 공유한다.
 *
 * 모든 CommunityDesk 라우트는 전역 프리픽스 `/api` 아래에 있고 JSON 으로 말한다.
 * 키는 헤더로 싣는다: 공개는 `x-pk`, 어드민은 `x-sk`(테넌트) 또는 `x-admin-token`(글로벌).
 */
export const SDK_VERSION = '0.1.0'

/** API 가 4xx/5xx 로 응답할 때 던지는 에러(상태 코드 + 서버 detail 보존). */
export class CommunityDeskError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown
  ) {
    super(message)
    this.name = 'CommunityDeskError'
  }
}

/** 글/댓글/게시판을 찾지 못했을 때(404) 식별 가능한 에러. */
export class NotFoundError extends CommunityDeskError {
  constructor(message = '리소스를 찾을 수 없습니다') {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}

export interface HttpClientOptions {
  /** API 베이스 URL. 예: 'https://community.example.com' (끝의 / 는 무시). */
  endpoint: string
  /** 모든 요청에 실을 정적 헤더(키 등). */
  baseHeaders: Record<string, string>
  /** 커스텀 fetch(SSR/Node/테스트). 기본은 전역 fetch. */
  fetch?: typeof fetch
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** JSON 바디(있으면 content-type: application/json 자동 설정). */
  body?: unknown
  /** 쿼리 파라미터(undefined/null 값은 제외). */
  query?: Record<string, string | number | boolean | undefined | null>
  signal?: AbortSignal
}

/** 가벼운 JSON HTTP 클라이언트 — base URL + 정적 헤더를 묶고 fetch/parse 를 표준화한다. */
export interface HttpClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>
}

function buildQuery(query: RequestOptions['query']): string {
  if (!query) return ''
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue
    usp.set(k, String(v))
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const base = options.endpoint.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  if (!doFetch) {
    throw new CommunityDeskError('fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.', 0)
  }

  return {
    async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
      const url = `${base}/api${path}${buildQuery(opts.query)}`
      const headers: Record<string, string> = {
        accept: 'application/json',
        'x-communitydesk-sdk': SDK_VERSION,
        ...options.baseHeaders,
      }
      let body: string | undefined
      if (opts.body !== undefined) {
        headers['content-type'] = 'application/json'
        body = JSON.stringify(opts.body)
      }

      const res = await doFetch(url, {
        method: opts.method ?? 'GET',
        headers,
        body,
        signal: opts.signal,
      })

      // 204 No Content (어드민 삭제 등)
      if (res.status === 204) return undefined as T

      const text = await res.text()
      const json: unknown = text ? safeParse(text) : null

      if (!res.ok) {
        const rec = (json ?? {}) as Record<string, unknown>
        const raw = rec.message ?? rec.error ?? `CommunityDesk 요청 실패 (${res.status})`
        const msg = Array.isArray(raw) ? raw.join(', ') : String(raw)
        if (res.status === 404) throw new NotFoundError(msg)
        throw new CommunityDeskError(msg, res.status, json)
      }

      return json as T
    },
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
