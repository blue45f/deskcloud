/**
 * FileDesk 위젯/SDK 클라이언트 — 의존성 0(타입만 @filedesk/shared 에서).
 *
 * publishable(`pk_`) 키로 호출하는 브라우저 안전 경로만 감쌉니다:
 *   upload(file, opts) — POST {endpoint}/api/files  (multipart: file 필드)  → UploadResultDto
 *
 * publishable 키는 브라우저 노출이 안전합니다(업로드만 가능, 목록/삭제는 서버 secret 키).
 * 서버는 Origin 도 테넌트별로 검사합니다. 진행률(progress)은 XMLHttpRequest 로 보고합니다.
 */
import type { UploadResultDto, Visibility } from '@filedesk/shared'

export type { UploadResultDto, Visibility }

const WIDGET_VERSION = '0.1.0'

export interface FileDeskClientOptions {
  /** publishable 키(`pk_…`). 브라우저 노출 안전. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://files.example.com' (끝의 / 는 무시). */
  endpoint: string
  /** 커스텀 fetch(SSR/테스트). 기본은 전역 fetch. progress 가 필요 없을 때 폴백 경로. */
  fetch?: typeof fetch
}

export interface UploadOptions {
  /** 가시성(public|private). 기본 public. */
  visibility?: Visibility
  /** 0~1 진행률 콜백(브라우저 XHR 경로에서만 보고; fetch 폴백은 완료 시 1). */
  onProgress?: (fraction: number) => void
  /** 취소 신호. */
  signal?: AbortSignal
  /** multipart 파일명 override(File 이 아닌 Blob 을 줄 때 권장). */
  filename?: string
}

/** FileDesk API 가 4xx/5xx 를 돌려줄 때 던지는 에러(원본 status·detail 보존). */
export class FileDeskError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown
  ) {
    super(message)
    this.name = 'FileDeskError'
  }
}

/** 업로드 입력 — 브라우저 File/Blob. */
export type UploadInput = File | Blob

export interface FileDeskClient {
  upload(file: UploadInput, options?: UploadOptions): Promise<UploadResultDto>
}

function messageFromBody(body: unknown, status: number): string {
  const rec = (body ?? {}) as Record<string, unknown>
  const raw = rec.message ?? rec.error ?? `FileDesk 요청 실패 (${status})`
  return Array.isArray(raw) ? raw.join(', ') : String(raw)
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function createFileDeskClient(options: FileDeskClientOptions): FileDeskClient {
  const base = options.endpoint.replace(/\/+$/, '')
  const url = `${base}/api/files`

  function buildForm(file: UploadInput, opts: UploadOptions): FormData {
    const form = new FormData()
    const name = opts.filename ?? (file instanceof File ? file.name : 'file')
    form.append('file', file, name)
    if (opts.visibility) form.append('visibility', opts.visibility)
    return form
  }

  /** XHR 경로 — 업로드 진행률을 보고할 수 있다(브라우저). */
  function uploadXhr(file: UploadInput, opts: UploadOptions): Promise<UploadResultDto> {
    return new Promise<UploadResultDto>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url, true)
      xhr.setRequestHeader('Authorization', `Bearer ${options.publishableKey}`)
      xhr.setRequestHeader('X-FileDesk-Widget', WIDGET_VERSION)

      if (opts.signal) {
        if (opts.signal.aborted) {
          reject(new FileDeskError('업로드가 취소되었습니다', 0))
          return
        }
        opts.signal.addEventListener('abort', () => xhr.abort(), { once: true })
      }

      xhr.upload.onprogress = (e: ProgressEvent): void => {
        if (e.lengthComputable && opts.onProgress) opts.onProgress(e.loaded / e.total)
      }
      xhr.onerror = (): void => reject(new FileDeskError('네트워크 오류로 업로드에 실패했습니다', 0))
      xhr.onabort = (): void => reject(new FileDeskError('업로드가 취소되었습니다', 0))
      xhr.onload = (): void => {
        const body = xhr.responseText ? safeJson(xhr.responseText) : null
        if (xhr.status >= 200 && xhr.status < 300) {
          opts.onProgress?.(1)
          resolve(body as UploadResultDto)
        } else {
          reject(new FileDeskError(messageFromBody(body, xhr.status), xhr.status, body))
        }
      }
      xhr.send(buildForm(file, opts))
    })
  }

  /** fetch 폴백 — 진행률 없음(완료 시 1). SSR/테스트/커스텀 fetch 주입 경로. */
  async function uploadFetch(file: UploadInput, opts: UploadOptions): Promise<UploadResultDto> {
    const doFetch = options.fetch ?? globalThis.fetch
    if (!doFetch) {
      throw new FileDeskError('fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.', 0)
    }
    const res = await doFetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.publishableKey}`,
        'x-filedesk-widget': WIDGET_VERSION,
      },
      body: buildForm(file, opts),
      signal: opts.signal,
    })
    const text = await res.text()
    const body: unknown = text ? safeJson(text) : null
    if (!res.ok) throw new FileDeskError(messageFromBody(body, res.status), res.status, body)
    opts.onProgress?.(1)
    return body as UploadResultDto
  }

  return {
    upload(file, options: UploadOptions = {}) {
      // 커스텀 fetch 가 주입됐거나 XHR 이 없으면 fetch 경로, 아니면 진행률 가능한 XHR.
      const canXhr = typeof XMLHttpRequest !== 'undefined'
      if (canXhr) return uploadXhr(file, options)
      return uploadFetch(file, options)
    },
  }
}
