/**
 * MediaDesk 브라우저 SDK 클라이언트 — 의존성 0.
 *
 * 공개(publishable) 엔드포인트 두 개만 감싼다(브라우저에서 pk_ + Origin 으로 인증):
 *   1) upload     — POST {endpoint}/api/uploads            (multipart, X-Publishable-Key)
 *   2) listAssets — GET  {endpoint}/api/assets             (X-Publishable-Key)
 * 그리고 서버 호출이 필요 없는 순수 URL 빌더:
 *   3) buildUrl   — 변환 쿼리(?w=&h=&format=&q=)가 붙은 공개 자산 URL을 만든다.
 *
 * secret 키(sk_)는 절대 다루지 않는다(브라우저 노출 금지). 자산 삭제/관리는 서버 SDK·어드민 몫.
 */
import type {
  AssetListResult,
  TransformOptions,
  UploadOptions,
  UploadResult,
} from './types'

const SDK_VERSION = '0.1.0'

/** 변환 파라미터 경계 — 과도한 요청 방지(서버와 동일 의미). */
const DIM_MIN = 1
const DIM_MAX = 4000
const Q_MIN = 1
const Q_MAX = 100
const FORMATS = new Set(['jpeg', 'png', 'webp', 'avif'])

export class MediaDeskError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown
  ) {
    super(message)
    this.name = 'MediaDeskError'
  }
}

export interface MediaDeskClientOptions {
  /** publishable 키(pk_…). 브라우저 노출 가능. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://media.example.com' (끝의 / 는 무시). */
  endpoint: string
  /** 커스텀 fetch(SSR/테스트). 기본은 전역 fetch. */
  fetch?: typeof fetch
}

export interface MediaDeskClient {
  /** 파일 업로드 → 자산 메타({ url, key, … }) 반환. */
  upload(file: File | Blob, options?: UploadOptions): Promise<UploadResult>
  /** 공개 자산 목록(폴더 필터·페이지네이션). */
  listAssets(params?: {
    folder?: string
    limit?: number
    offset?: number
    signal?: AbortSignal
  }): Promise<AssetListResult>
  /** 키 → 변환 쿼리가 붙은 공개 자산 URL(서버 호출 없음). */
  buildUrl(key: string, transform?: TransformOptions): string
  /** 설정된 publishable 키. */
  readonly publishableKey: string
  /** 정규화된 베이스 URL. */
  readonly endpoint: string
}

function trimSlashes(s: string): string {
  return s.replace(/\/+$/g, '')
}

function clampInt(v: number, min: number, max: number): number {
  const n = Math.round(v)
  return n < min ? min : n > max ? max : n
}

/**
 * 변환 쿼리 문자열(앞의 '?' 제외)을 만든다. 잘못된 값은 조용히 무시·클램프한다.
 * 어떤 변환도 없으면 빈 문자열.
 */
export function transformQuery(transform?: TransformOptions): string {
  if (!transform) return ''
  const params = new URLSearchParams()
  if (typeof transform.w === 'number' && Number.isFinite(transform.w)) {
    params.set('w', String(clampInt(transform.w, DIM_MIN, DIM_MAX)))
  }
  if (typeof transform.h === 'number' && Number.isFinite(transform.h)) {
    params.set('h', String(clampInt(transform.h, DIM_MIN, DIM_MAX)))
  }
  if (transform.format && FORMATS.has(transform.format)) {
    params.set('format', transform.format)
  }
  if (typeof transform.q === 'number' && Number.isFinite(transform.q)) {
    params.set('q', String(clampInt(transform.q, Q_MIN, Q_MAX)))
  }
  return params.toString()
}

/**
 * 공개 자산 URL을 만든다.
 *  - key 가 이미 절대 URL(http/https)이면 변환 쿼리만 덧붙인다(자산 url 재활용).
 *  - 아니면 `{endpoint}/file/{key}` 로 조합한다. (테넌트 세그먼트는 publishable 키로
 *    서버가 식별하므로 공개 파일 경로에 직접 넣지 않는다 — 키만으로 충분.)
 */
export function buildUrlFrom(
  endpoint: string,
  key: string,
  transform?: TransformOptions
): string {
  const q = transformQuery(transform)
  const isAbsolute = /^https?:\/\//i.test(key)
  const base = isAbsolute
    ? key
    : `${trimSlashes(endpoint)}/file/${key.split('/').map(encodeURIComponent).join('/')}`
  if (!q) return base
  return base.includes('?') ? `${base}&${q}` : `${base}?${q}`
}

async function parseError(res: Response): Promise<MediaDeskError> {
  let detail: unknown = null
  let message = `MediaDesk 요청 실패 (${res.status})`
  try {
    const text = await res.text()
    if (text) {
      detail = JSON.parse(text)
      const rec = detail as Record<string, unknown>
      const raw = rec.message ?? rec.error
      if (raw) message = Array.isArray(raw) ? raw.join(', ') : String(raw)
    }
  } catch {
    /* 비-JSON 본문 무시 */
  }
  return new MediaDeskError(message, res.status, detail)
}

export function createMediaDeskClient(options: MediaDeskClientOptions): MediaDeskClient {
  const endpoint = trimSlashes(options.endpoint)
  const publishableKey = options.publishableKey
  const doFetch = options.fetch ?? globalThis.fetch

  function authHeaders(): Record<string, string> {
    return {
      'x-publishable-key': publishableKey,
      'x-mediadesk-sdk': SDK_VERSION,
    }
  }

  async function listAssets(params?: {
    folder?: string
    limit?: number
    offset?: number
    signal?: AbortSignal
  }): Promise<AssetListResult> {
    if (!doFetch) {
      throw new MediaDeskError('fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.', 0)
    }
    const url = new URL(`${endpoint}/api/assets`)
    if (params?.folder) url.searchParams.set('folder', params.folder)
    if (typeof params?.limit === 'number') url.searchParams.set('limit', String(params.limit))
    if (typeof params?.offset === 'number') url.searchParams.set('offset', String(params.offset))
    const res = await doFetch(url.toString(), {
      method: 'GET',
      headers: authHeaders(),
      signal: params?.signal,
    })
    if (!res.ok) throw await parseError(res)
    return (await res.json()) as AssetListResult
  }

  function upload(file: File | Blob, opts: UploadOptions = {}): Promise<UploadResult> {
    // 진행률이 필요하면(또는 기본) XHR — fetch 는 업로드 진행 이벤트를 노출하지 않는다.
    // XHR 가 없는 환경(SSR/테스트)에서는 fetch 로 폴백한다.
    if (typeof XMLHttpRequest === 'undefined') {
      return uploadViaFetch(file, opts)
    }
    return uploadViaXhr(file, opts)
  }

  function buildForm(file: File | Blob, opts: UploadOptions): FormData {
    const form = new FormData()
    const filename =
      opts.filename ?? (file instanceof File ? file.name : 'upload')
    form.append('file', file, filename)
    if (opts.folder) form.append('folder', opts.folder)
    return form
  }

  async function uploadViaFetch(file: File | Blob, opts: UploadOptions): Promise<UploadResult> {
    if (!doFetch) {
      throw new MediaDeskError('fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.', 0)
    }
    opts.onProgress?.(0)
    const res = await doFetch(`${endpoint}/api/uploads`, {
      method: 'POST',
      headers: authHeaders(),
      body: buildForm(file, opts),
      signal: opts.signal,
    })
    if (!res.ok) throw await parseError(res)
    const json = (await res.json()) as UploadResult
    opts.onProgress?.(1)
    return json
  }

  function uploadViaXhr(file: File | Blob, opts: UploadOptions): Promise<UploadResult> {
    return new Promise<UploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${endpoint}/api/uploads`)
      for (const [k, v] of Object.entries(authHeaders())) xhr.setRequestHeader(k, v)

      if (opts.signal) {
        if (opts.signal.aborted) {
          xhr.abort()
          reject(new MediaDeskError('업로드가 취소되었습니다.', 0))
          return
        }
        opts.signal.addEventListener('abort', () => xhr.abort(), { once: true })
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && opts.onProgress) opts.onProgress(e.loaded / e.total)
      })
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText) as UploadResult
            opts.onProgress?.(1)
            resolve(json)
          } catch {
            reject(new MediaDeskError('업로드 응답을 해석하지 못했습니다.', xhr.status))
          }
        } else {
          let message = `업로드 실패 (${xhr.status})`
          let detail: unknown = null
          try {
            detail = JSON.parse(xhr.responseText)
            const rec = detail as Record<string, unknown>
            const raw = rec.message ?? rec.error
            if (raw) message = Array.isArray(raw) ? raw.join(', ') : String(raw)
          } catch {
            /* ignore */
          }
          reject(new MediaDeskError(message, xhr.status, detail))
        }
      })
      xhr.addEventListener('error', () =>
        reject(new MediaDeskError('네트워크 오류로 업로드에 실패했습니다.', 0))
      )
      xhr.addEventListener('abort', () =>
        reject(new MediaDeskError('업로드가 취소되었습니다.', 0))
      )

      opts.onProgress?.(0)
      xhr.send(buildForm(file, opts))
    })
  }

  return {
    publishableKey,
    endpoint,
    upload,
    listAssets,
    buildUrl: (key, transform) => buildUrlFrom(endpoint, key, transform),
  }
}
