/**
 * <MediaUploader> — publishable 키로 동작하는 드래그앤드롭/클릭 업로더.
 *
 * - 드래그앤드롭 + 클릭(키보드 Enter/Space) + 숨김 <input type=file>
 * - 미리보기(이미지는 objectURL 썸네일), 진행률 바, 성공/실패 배지
 * - 클라이언트 측 용량/MIME 가드(서버가 2차 검증)
 * - 접근성: 라벨·role·aria-live, focus-visible, reduced-motion
 *
 * 의존성: react(peer) + @mediadesk/sdk(업로드). 외부 CSS 프레임워크 0.
 */
import { createMediaDeskClient, type MediaDeskClient, type UploadResult } from '@mediadesk/sdk'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactElement,
} from 'react'

import { DEFAULT_ACCEPT, formatBytes, isImageMime, isMimeAccepted, shortId } from './helpers'
import { AlertIcon, CheckIcon, FileIcon, UploadIcon } from './icons'
import {
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_INK,
  ensureStyles,
  themeVars,
  type WidgetTheme,
} from './styles'

export interface MediaUploaderProps {
  /** publishable 키(pk_…). */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://media.example.com'. */
  endpoint: string
  /** 업로드 대상 논리 폴더. 예: 'avatars'. */
  folder?: string
  /** 허용 MIME/확장자 토큰. 예: ['image/*', '.pdf']. 기본은 이미지+PDF. */
  accept?: readonly string[]
  /** 단일 파일 최대 바이트(기본 10MB). 초과 시 거부. */
  maxBytes?: number
  /** 한 번에 여러 파일 허용(기본 true). */
  multiple?: boolean
  /** 강조색(기본 #2f5fe0). */
  accent?: string
  accentInk?: string
  /** 비활성화. */
  disabled?: boolean
  /** 안내 문구(드롭존 제목). */
  label?: string
  /** 업로드 1건 성공 콜백. */
  onUploaded?: (asset: UploadResult) => void
  /** 업로드 실패 콜백. */
  onError?: (error: Error, file: File) => void
  /** 커스텀 fetch(SSR/테스트). */
  fetch?: typeof fetch
  /** 외부 클라이언트 주입(테스트/공유). 주면 publishableKey/endpoint 보다 우선. */
  client?: MediaDeskClient
}

type ItemStatus = 'uploading' | 'done' | 'error'

interface UploadItem {
  id: string
  name: string
  size: number
  mime: string
  previewUrl?: string
  status: ItemStatus
  progress: number
  error?: string
  result?: UploadResult
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024

export function MediaUploader(props: MediaUploaderProps): ReactElement {
  const {
    publishableKey,
    endpoint,
    folder,
    accept = DEFAULT_ACCEPT,
    maxBytes = DEFAULT_MAX_BYTES,
    multiple = true,
    accent = DEFAULT_ACCENT,
    accentInk = DEFAULT_ACCENT_INK,
    disabled = false,
    label = '파일을 끌어다 놓거나 선택하세요',
    onUploaded,
    onError,
    fetch: customFetch,
    client: injectedClient,
  } = props

  const client = useMemo<MediaDeskClient>(
    () => injectedClient ?? createMediaDeskClient({ publishableKey, endpoint, fetch: customFetch }),
    [injectedClient, publishableKey, endpoint, customFetch]
  )

  const [items, setItems] = useState<UploadItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [rejectError, setRejectError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const inputId = useId()

  const theme: WidgetTheme = { accent, accentInk }

  useEffect(() => {
    if (typeof document !== 'undefined') ensureStyles()
  }, [])

  // 미리보기 objectURL 정리
  useEffect(() => {
    return () => {
      for (const it of items) if (it.previewUrl) URL.revokeObjectURL(it.previewUrl)
    }
    // 언마운트 시 한 번만 정리(items 의존 X — 누수보다 단순/안전 우선)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patchItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  const startUpload = useCallback(
    (file: File) => {
      const id = shortId()
      const previewUrl =
        typeof URL !== 'undefined' && isImageMime(file.type) ? URL.createObjectURL(file) : undefined
      const item: UploadItem = {
        id,
        name: file.name,
        size: file.size,
        mime: file.type,
        previewUrl,
        status: 'uploading',
        progress: 0,
      }
      setItems((prev) => [...prev, item])

      client
        .upload(file, {
          folder,
          onProgress: (fraction) => patchItem(id, { progress: fraction }),
        })
        .then((result) => {
          patchItem(id, { status: 'done', progress: 1, result })
          onUploaded?.(result)
        })
        .catch((e: unknown) => {
          const message = e instanceof Error ? e.message : '업로드에 실패했습니다.'
          patchItem(id, { status: 'error', error: message })
          onError?.(e instanceof Error ? e : new Error(message), file)
        })
    },
    [client, folder, onUploaded, onError, patchItem]
  )

  const acceptFiles = useCallback(
    (fileList: FileList | File[]) => {
      if (disabled) return
      setRejectError(null)
      const files = Array.from(fileList)
      const toUpload = multiple ? files : files.slice(0, 1)
      const rejected: string[] = []
      for (const file of toUpload) {
        if (!isMimeAccepted(accept, file)) {
          rejected.push(`${file.name}: 허용되지 않는 형식`)
          continue
        }
        if (file.size > maxBytes) {
          rejected.push(`${file.name}: 용량 초과(최대 ${formatBytes(maxBytes)})`)
          continue
        }
        startUpload(file)
      }
      if (rejected.length > 0) setRejectError(rejected.join(' · '))
    },
    [accept, disabled, maxBytes, multiple, startUpload]
  )

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      if (e.dataTransfer?.files?.length) acceptFiles(e.dataTransfer.files)
    },
    [acceptFiles]
  )

  const openPicker = useCallback(() => {
    if (!disabled) inputRef.current?.click()
  }, [disabled])

  const clearDone = useCallback(() => {
    setItems((prev) => {
      for (const it of prev) {
        if (it.status === 'done' && it.previewUrl) URL.revokeObjectURL(it.previewUrl)
      }
      return prev.filter((it) => it.status !== 'done')
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((it) => it.id !== id)
    })
  }, [])

  const rootStyle = themeVars(theme) as CSSProperties
  const acceptAttr = accept.join(',')
  const doneCount = items.filter((it) => it.status === 'done').length

  return (
    <div className="md-root md-uploader" style={rootStyle}>
      <div
        className={`md-drop${dragging ? ' md-dragging' : ''}${disabled ? ' md-disabled' : ''}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-label={label}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          if (disabled) return
          dragDepth.current += 1
          setDragging(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault()
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (dragDepth.current === 0) setDragging(false)
        }}
        onDrop={onDrop}
      >
        <span className="md-drop-icon" aria-hidden="true">
          <UploadIcon />
        </span>
        <p className="md-drop-title">{label}</p>
        <p className="md-drop-hint">
          최대 {formatBytes(maxBytes)}
          {multiple ? ' · 여러 개 가능' : ''} · <span className="md-drop-cta">찾아보기</span>
        </p>
        <input
          ref={inputRef}
          id={inputId}
          className="md-visually-hidden"
          type="file"
          accept={acceptAttr}
          multiple={multiple}
          disabled={disabled}
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files?.length) acceptFiles(e.target.files)
            e.target.value = '' // 같은 파일 재선택 허용
          }}
        />
      </div>

      {rejectError ? (
        <p className="md-alert" role="alert">
          {rejectError}
        </p>
      ) : null}

      {items.length > 0 ? (
        <>
          <ul className="md-items" aria-live="polite">
            {items.map((it) => (
              <li key={it.id} className="md-item">
                <span className="md-item-thumb" aria-hidden="true">
                  {it.previewUrl ? <img src={it.previewUrl} alt="" /> : <FileIcon />}
                </span>
                <div className="md-item-main">
                  <p className="md-item-name" title={it.name}>
                    {it.name}
                  </p>
                  {it.status === 'error' ? (
                    <p className="md-item-meta md-err">{it.error}</p>
                  ) : (
                    <p className="md-item-meta">
                      {formatBytes(it.size)}
                      {it.status === 'uploading' ? ` · ${Math.round(it.progress * 100)}%` : ''}
                      {it.status === 'done' ? ' · 완료' : ''}
                    </p>
                  )}
                  {it.status === 'uploading' ? (
                    <div
                      className="md-progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(it.progress * 100)}
                      aria-label={`${it.name} 업로드 진행률`}
                    >
                      <div className="md-progress-bar" style={{ width: `${it.progress * 100}%` }} />
                    </div>
                  ) : null}
                </div>
                <div className="md-item-status">
                  {it.status === 'uploading' ? (
                    <span className="md-spinner" aria-hidden="true" />
                  ) : null}
                  {it.status === 'done' ? (
                    <span className="md-badge md-ok" aria-label="업로드 완료">
                      <CheckIcon />
                    </span>
                  ) : null}
                  {it.status === 'error' ? (
                    <span className="md-badge md-bad" aria-label="업로드 실패">
                      <AlertIcon />
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="md-iconbtn"
                    aria-label={`${it.name} 목록에서 제거`}
                    onClick={() => removeItem(it.id)}
                  >
                    <CloseIconInline />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {doneCount > 0 ? (
            <div className="md-actions">
              <span className="md-actions-spacer" />
              <button type="button" className="md-btn md-btn-ghost" onClick={clearDone}>
                완료 항목 비우기
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

// 작은 X 아이콘(item 제거용) — icons.tsx CloseIcon 재사용.
function CloseIconInline(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
