/**
 * FileDesk — 단일 파일 벤더링 컴포넌트 (의존성: react 만).
 * ──────────────────────────────────────────────────────────────────────────
 * npm publish 가 막힌 동안 형제/외부 앱에 그대로 복붙해서 쓰는 버전입니다.
 * 워크스페이스 의존(@filedesk/shared·@filedesk/widget) 0 — 필요한 상수·검증·클라이언트
 * 로직을 이 파일에 인라인했습니다. 동작/디자인은 @filedesk/widget 의 <FileUpload> 와 동일합니다.
 *
 * 사용:
 *   import { FileUpload } from './FileUpload'
 *   <FileUpload publishableKey="pk_…" endpoint="https://files.example.com"
 *               onUploaded={(f) => console.log(f.url)} />
 *
 * 백엔드 계약(공개·publishable 키):
 *   POST {endpoint}/api/files   (multipart: file 필드, visibility?)  → { id, key, url, … }
 *
 * 접근성/디자인: focus-visible · prefers-reduced-motion · 대비 ≥4.5:1 ·
 * 그라디언트 텍스트/글래스모피즘/사이드스트라이프 없음 · 외부 CSS 프레임워크 0.
 * ──────────────────────────────────────────────────────────────────────────
 */
import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactElement,
} from 'react'

/* ============================ 공유 계약(인라인) ============================ */

const DEFAULT_MAX_FILE_BYTES = 5 * 1024 * 1024
const FILENAME_MAX = 255

const ALLOWED_CONTENT_TYPES: readonly string[] = [
  'image/*',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/zip',
  'application/gzip',
  'application/x-tar',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]

export type Visibility = 'public' | 'private'

export interface UploadResult {
  id: string
  key: string
  url: string
  filename: string
  contentType: string
  sizeBytes: number
  visibility: Visibility
}

function normalizeContentType(raw: string | null | undefined): string {
  if (!raw) return ''
  const semi = raw.indexOf(';')
  const base = semi >= 0 ? raw.slice(0, semi) : raw
  return base.trim().toLowerCase()
}

function isAllowedContentType(contentType: string | null | undefined): boolean {
  const ct = normalizeContentType(contentType)
  if (!ct) return false
  for (const pattern of ALLOWED_CONTENT_TYPES) {
    if (pattern === ct) return true
    if (pattern.endsWith('/*') && ct.startsWith(pattern.slice(0, -1))) return true
  }
  return false
}

type ValidationError =
  | 'filename-required'
  | 'filename-too-long'
  | 'content-type-not-allowed'
  | 'size-zero'
  | 'size-too-large'

const ERROR_MESSAGES: Record<ValidationError, string> = {
  'filename-required': '파일명이 필요합니다',
  'filename-too-long': `파일명이 너무 깁니다(최대 ${FILENAME_MAX}자)`,
  'content-type-not-allowed': '허용되지 않는 파일 형식입니다',
  'size-zero': '빈 파일은 업로드할 수 없습니다',
  'size-too-large': '파일이 최대 허용 크기를 초과했습니다',
}

function validate(file: File, maxBytes: number): ValidationError | null {
  const name = file.name?.trim() ?? ''
  if (!name) return 'filename-required'
  if (name.length > FILENAME_MAX) return 'filename-too-long'
  if (!isAllowedContentType(file.type)) return 'content-type-not-allowed'
  if (file.size === 0) return 'size-zero'
  if (file.size > maxBytes) return 'size-too-large'
  return null
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[i]}`
}

/* ============================ 클라이언트(인라인) ============================ */

class FileDeskError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'FileDeskError'
  }
}

interface UploadHandlers {
  visibility: Visibility
  onProgress: (fraction: number) => void
}

/** XHR 업로드(진행률 보고). publishable 키 + multipart. */
function uploadFile(
  endpoint: string,
  publishableKey: string,
  file: File,
  handlers: UploadHandlers
): Promise<UploadResult> {
  const base = endpoint.replace(/\/+$/, '')
  return new Promise<UploadResult>((resolve, reject) => {
    const form = new FormData()
    form.append('file', file, file.name)
    form.append('visibility', handlers.visibility)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${base}/api/files`, true)
    xhr.setRequestHeader('Authorization', `Bearer ${publishableKey}`)
    xhr.upload.onprogress = (e): void => {
      if (e.lengthComputable) handlers.onProgress(e.loaded / e.total)
    }
    xhr.onerror = (): void => reject(new FileDeskError('네트워크 오류로 업로드에 실패했습니다', 0))
    xhr.onload = (): void => {
      let body: unknown = null
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        body = xhr.responseText
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        handlers.onProgress(1)
        resolve(body as UploadResult)
      } else {
        const rec = (body ?? {}) as Record<string, unknown>
        const raw = rec.message ?? rec.error ?? `업로드 실패 (${xhr.status})`
        const msg = Array.isArray(raw) ? raw.join(', ') : String(raw)
        reject(new FileDeskError(msg, xhr.status))
      }
    }
    xhr.send(form)
  })
}

/* ============================ 스타일(인라인) ============================ */

const DEFAULT_ACCENT = '#2f5fe0'
const STYLE_ID = 'filedesk-vendor-styles'

function ensureStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
}

/* ============================ 컴포넌트 ============================ */

export interface FileUploadProps {
  publishableKey: string
  endpoint: string
  onUploaded?: (result: UploadResult) => void
  onError?: (error: Error, file: File) => void
  visibility?: Visibility
  multiple?: boolean
  accept?: string
  maxBytes?: number
  accent?: string
  label?: string
}

type ItemStatus = 'uploading' | 'done' | 'error'
interface Item {
  id: string
  name: string
  size: number
  status: ItemStatus
  progress: number
  error?: string
}

let seq = 0
const nextId = (): string => `fd-${Date.now()}-${(seq += 1)}`

export function FileUpload(props: FileUploadProps): ReactElement {
  const {
    publishableKey,
    endpoint,
    onUploaded,
    onError,
    visibility = 'public',
    multiple = true,
    accept,
    maxBytes = DEFAULT_MAX_FILE_BYTES,
    accent = DEFAULT_ACCENT,
    label = '파일을 끌어다 놓거나 클릭해 업로드',
  } = props

  const [items, setItems] = useState<Item[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  ensureStyles()

  const rootStyle = useMemo<CSSProperties>(
    () => ({ '--fd-accent': accent }) as CSSProperties,
    [accent]
  )

  const patch = useCallback((id: string, p: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)))
  }, [])

  const uploadOne = useCallback(
    (file: File) => {
      const id = nextId()
      const err = validate(file, maxBytes)
      if (err) {
        const msg = ERROR_MESSAGES[err]
        setItems((prev) => [
          ...prev,
          { id, name: file.name, size: file.size, status: 'error', progress: 0, error: msg },
        ])
        onError?.(new Error(msg), file)
        return
      }
      setItems((prev) => [
        ...prev,
        { id, name: file.name, size: file.size, status: 'uploading', progress: 0 },
      ])
      uploadFile(endpoint, publishableKey, file, {
        visibility,
        onProgress: (f) => patch(id, { progress: f }),
      })
        .then((result) => {
          patch(id, { status: 'done', progress: 1 })
          onUploaded?.(result)
        })
        .catch((e: unknown) => {
          const message = e instanceof Error ? e.message : '업로드에 실패했습니다'
          patch(id, { status: 'error', error: message })
          onError?.(e instanceof Error ? e : new Error(message), file)
        })
    },
    [endpoint, publishableKey, visibility, maxBytes, patch, onUploaded, onError]
  )

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return
      const files = Array.from(list)
      for (const f of multiple ? files : files.slice(0, 1)) uploadOne(f)
    },
    [multiple, uploadOne]
  )

  const openPicker = useCallback(() => inputRef.current?.click(), [])
  const removeItem = useCallback(
    (id: string) => setItems((prev) => prev.filter((it) => it.id !== id)),
    []
  )

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      handleFiles(e.dataTransfer?.files ?? null)
    },
    [handleFiles]
  )

  return (
    <div className="fdv-root" style={rootStyle}>
      <div
        className={`fdv-dropzone${dragging ? ' fdv-dragging' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker()
          }
        }}
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragging(false)
        }}
      >
        <p className="fdv-dz-title">{label}</p>
        <p className="fdv-dz-hint">
          <span className="fdv-dz-link">파일 선택</span>
          {accept ? ` · ${accept}` : ''}
        </p>
        <input
          id={inputId}
          ref={inputRef}
          className="fdv-input"
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {items.length > 0 ? (
        <ul className="fdv-list" aria-label="업로드 목록">
          {items.map((it) => (
            <li key={it.id} className={`fdv-item${it.status === 'error' ? ' fdv-err' : ''}`}>
              <span className="fdv-item-body">
                <p className="fdv-item-name" title={it.name}>
                  {it.name}
                </p>
                <p className="fdv-item-meta">
                  {it.status === 'error'
                    ? it.error
                    : it.status === 'done'
                      ? `${formatBytes(it.size)} · 업로드 완료`
                      : `${formatBytes(it.size)} · ${Math.round(it.progress * 100)}%`}
                </p>
                {it.status === 'uploading' ? (
                  <span
                    className="fdv-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(it.progress * 100)}
                  >
                    <span className="fdv-progress-bar" style={{ width: `${it.progress * 100}%` }} />
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                className="fdv-remove"
                aria-label={`${it.name} 목록에서 제거`}
                onClick={() => removeItem(it.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

const CSS = `
.fdv-root, .fdv-root * { box-sizing: border-box; }
.fdv-root {
  --fd-accent: ${DEFAULT_ACCENT};
  --fd-ink: #1a1d23; --fd-ink-soft: #4a4f57; --fd-muted: #6b7280;
  --fd-surface: #fff; --fd-surface-2: #f4f5f7; --fd-drop: #eef3ff;
  --fd-border: #d7dae0; --fd-border-strong: #b7bcc6; --fd-danger: #b42318; --fd-success: #1a7f47;
  display: block; width: 100%;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--fd-ink); line-height: 1.5;
}
.fdv-dropzone {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  width: 100%; min-height: 152px; padding: 24px 18px;
  border: 2px dashed var(--fd-border-strong); border-radius: 14px;
  background: var(--fd-surface); color: var(--fd-ink-soft); text-align: center; cursor: pointer;
  transition: border-color .14s, background .14s;
}
.fdv-dropzone:hover { border-color: var(--fd-accent); background: var(--fd-surface-2); }
.fdv-dropzone.fdv-dragging { border-color: var(--fd-accent); background: var(--fd-drop); }
.fdv-dz-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--fd-ink); }
.fdv-dz-hint { margin: 0; font-size: 12px; color: var(--fd-muted); }
.fdv-dz-link { color: var(--fd-accent); font-weight: 600; text-decoration: underline; }
.fdv-input { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
.fdv-list { margin: 12px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.fdv-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--fd-border); border-radius: 9px; background: var(--fd-surface); }
.fdv-item-body { flex: 1; min-width: 0; }
.fdv-item-name { margin: 0; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fdv-item-meta { margin: 2px 0 0; font-size: 11px; color: var(--fd-muted); }
.fdv-item.fdv-err .fdv-item-meta { color: var(--fd-danger); }
.fdv-progress { display: block; margin-top: 6px; height: 6px; width: 100%; border-radius: 999px; background: var(--fd-surface-2); overflow: hidden; }
.fdv-progress-bar { display: block; height: 100%; background: var(--fd-accent); border-radius: 999px; transition: width .18s; }
.fdv-remove { flex: none; width: 26px; height: 26px; border: 0; border-radius: 6px; background: transparent; color: var(--fd-muted); cursor: pointer; font-size: 13px; }
.fdv-remove:hover { background: var(--fd-surface-2); color: var(--fd-ink); }
.fdv-root :focus { outline: none; }
.fdv-root :focus-visible { outline: 2px solid var(--fd-accent); outline-offset: 2px; border-radius: 8px; }
@media (prefers-reduced-motion: reduce) { .fdv-root *, .fdv-dropzone, .fdv-progress-bar { transition-duration: .001ms !important; } }
`
