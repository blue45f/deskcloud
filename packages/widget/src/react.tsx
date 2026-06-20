/**
 * @filedesk/widget/react — <FileUpload> 컴포넌트.
 *
 * 드래그-드롭(또는 클릭 선택) 업로더 + 파일별 진행률 + 성공/에러 상태. publishable(pk_)
 * 키로 업로드한다(브라우저 노출 안전). 클라이언트단 검증(크기·MIME)은 @filedesk/shared 의
 * validateUpload 를 그대로 써 서버와 동일 규칙을 적용한다.
 *
 * 의존성은 react(peer)뿐. 외부 CSS 프레임워크 0(스코프 .fd-* 스타일).
 */
import {
  formatBytes,
  UPLOAD_ERROR_MESSAGES,
  validateUpload,
  type UploadResultDto,
  type Visibility,
} from '@filedesk/shared'
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

import { createFileDeskClient, type FileDeskClient } from './client'
import { AlertIcon, CheckIcon, CloseIcon, FileIcon, UploadCloudIcon } from './icons'
import {
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_INK,
  ensureStyles,
  themeVars,
  type WidgetTheme,
} from './styles'

export interface FileUploadProps {
  /** publishable 키(`pk_…`). 브라우저 노출 안전. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://files.example.com'. */
  endpoint: string
  /** 업로드 성공 콜백(파일 1건마다 호출). */
  onUploaded?: (result: UploadResultDto) => void
  /** 업로드 실패 콜백(파일 1건마다). */
  onError?: (error: Error, file: File) => void
  /** 가시성(public|private). 기본 public. */
  visibility?: Visibility
  /** 다중 선택 허용. 기본 true. */
  multiple?: boolean
  /** accept 속성(파일 선택 다이얼로그 필터). 예: 'image/*,application/pdf'. */
  accept?: string
  /** 클라이언트단 최대 바이트(서버도 독립 검증). 기본 5MB(shared). */
  maxBytes?: number
  /** 강조색. 기본 #2f5fe0. */
  accent?: string
  /** accent 위 텍스트색. 기본 흰색. */
  accentInk?: string
  /** 드롭존 제목 문구. */
  label?: string
  /** 커스텀 fetch(SSR/테스트). 주면 진행률 없는 fetch 경로 사용. */
  fetch?: typeof fetch
  /** 외부에서 만든 클라이언트 주입(테스트/공유용). */
  client?: FileDeskClient
}

type ItemStatus = 'uploading' | 'done' | 'error'

interface UploadItem {
  id: string
  name: string
  size: number
  status: ItemStatus
  progress: number
  error?: string
  result?: UploadResultDto
}

let itemSeq = 0
const nextItemId = (): string => `fd-${Date.now()}-${(itemSeq += 1)}`

export function FileUpload(props: FileUploadProps): ReactElement {
  const {
    publishableKey,
    endpoint,
    onUploaded,
    onError,
    visibility = 'public',
    multiple = true,
    accept,
    maxBytes,
    accent = DEFAULT_ACCENT,
    accentInk = DEFAULT_ACCENT_INK,
    label = '파일을 끌어다 놓거나 클릭해 업로드',
    fetch: customFetch,
    client: injectedClient,
  } = props

  const client = useMemo<FileDeskClient>(
    () => injectedClient ?? createFileDeskClient({ publishableKey, endpoint, fetch: customFetch }),
    [injectedClient, publishableKey, endpoint, customFetch]
  )

  const [items, setItems] = useState<UploadItem[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const theme: WidgetTheme = { accent, accentInk }
  const inputId = useId()

  // 스타일 1회 주입(브라우저에서만)
  if (typeof document !== 'undefined') ensureStyles()

  const patchItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  const uploadOne = useCallback(
    (file: File) => {
      const id = nextItemId()
      // 클라이언트단 검증 — 서버와 동일 규칙(빠른 피드백, 서버도 독립 재검증).
      const verdict = validateUpload(
        { filename: file.name, contentType: file.type, sizeBytes: file.size },
        maxBytes != null ? { maxBytes } : {}
      )
      if (!verdict.ok) {
        const msg = UPLOAD_ERROR_MESSAGES[verdict.errors[0]!]
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

      client
        .upload(file, { visibility, onProgress: (f) => patchItem(id, { progress: f }) })
        .then((result) => {
          patchItem(id, { status: 'done', progress: 1, result })
          onUploaded?.(result)
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : '업로드에 실패했습니다'
          patchItem(id, { status: 'error', error: message })
          onError?.(err instanceof Error ? err : new Error(message), file)
        })
    },
    [client, visibility, maxBytes, patchItem, onUploaded, onError]
  )

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return
      const files = Array.from(fileList)
      for (const f of multiple ? files : files.slice(0, 1)) uploadOne(f)
    },
    [multiple, uploadOne]
  )

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      handleFiles(e.dataTransfer?.files ?? null)
    },
    [handleFiles]
  )

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
  }, [])

  const openPicker = useCallback(() => inputRef.current?.click(), [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }, [])

  const rootStyle = themeVars(theme) as CSSProperties

  return (
    <div className="fd-root" style={rootStyle}>
      <div
        className={`fd-dropzone${dragging ? ' fd-dragging' : ''}`}
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
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <span className="fd-dz-icon">
          <UploadCloudIcon />
        </span>
        <p className="fd-dz-title">{label}</p>
        <p className="fd-dz-hint">
          <span className="fd-dz-link">파일 선택</span>
          {accept ? ` · ${accept}` : ''}
        </p>
        <input
          id={inputId}
          ref={inputRef}
          className="fd-input"
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = '' // 같은 파일 재선택 허용
          }}
        />
      </div>

      {items.length > 0 ? (
        <ul className="fd-list" aria-label="업로드 목록">
          {items.map((it) => (
            <li key={it.id} className={`fd-item${it.status === 'error' ? ' fd-err' : ''}`}>
              <span className="fd-item-icon">
                <FileIcon />
              </span>
              <span className="fd-item-body">
                <p className="fd-item-name" title={it.name}>
                  {it.name}
                </p>
                <p className="fd-item-meta">
                  {it.status === 'error'
                    ? it.error
                    : it.status === 'done'
                      ? `${formatBytes(it.size)} · 업로드 완료`
                      : `${formatBytes(it.size)} · ${Math.round(it.progress * 100)}%`}
                </p>
                {it.status === 'uploading' ? (
                  <span
                    className="fd-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(it.progress * 100)}
                  >
                    <span className="fd-progress-bar" style={{ width: `${it.progress * 100}%` }} />
                  </span>
                ) : null}
              </span>
              {it.status === 'done' ? (
                <span className="fd-item-status fd-ok" aria-label="완료">
                  <CheckIcon />
                </span>
              ) : null}
              {it.status === 'error' ? (
                <span className="fd-item-status fd-bad" aria-label="실패">
                  <AlertIcon />
                </span>
              ) : null}
              <button
                type="button"
                className="fd-remove"
                aria-label={`${it.name} 목록에서 제거`}
                onClick={() => removeItem(it.id)}
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
