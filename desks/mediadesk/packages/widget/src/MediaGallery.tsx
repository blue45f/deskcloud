/**
 * <MediaGallery> — publishable 키로 공개 자산을 받아 반응형 변환 썸네일 그리드로 보여준다.
 *
 * - 마운트 시 listAssets 로 자산 목록을 GET
 * - 이미지는 buildUrl 변환 썸네일(정사각 cover)로, 비-이미지는 파일 아이콘으로 렌더
 * - 로딩 / 빈 상태 / 에러 처리, 클릭 시 원본(새 탭)
 * - 접근성: alt, 키보드 포커스(링크/버튼), aria-busy
 *
 * 의존성: react(peer) + @mediadesk/sdk(목록·buildUrl). 외부 CSS 프레임워크 0.
 */
import {
  createMediaDeskClient,
  type MediaAsset,
  type MediaDeskClient,
  type TransformFormat,
} from '@mediadesk/sdk'
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  forwardRef,
  type CSSProperties,
  type ForwardedRef,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from 'react'

import { isImageMime } from './helpers'
import { AlertIcon, FileIcon, ImageIcon } from './icons'
import {
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_INK,
  ensureStyles,
  themeVars,
  type WidgetTheme,
} from './styles'

export interface MediaGalleryProps {
  /** publishable 키(pk_…). */
  publishableKey: string
  /** API 베이스 URL. */
  endpoint: string
  /** 폴더 필터. 비우면 전체. */
  folder?: string
  /** 가져올 최대 개수(기본 60). */
  limit?: number
  /** 썸네일 한 변(px, 그리드 셀 최소폭에도 사용). 기본 160. */
  thumbSize?: number
  /** 썸네일 출력 포맷(기본 webp). */
  thumbFormat?: TransformFormat
  /** 썸네일 품질 1–100(기본 70). */
  thumbQuality?: number
  /** 강조색. */
  accent?: string
  accentInk?: string
  /** 파일명 캡션 표시(기본 true). */
  showCaptions?: boolean
  /** 항목 클릭 콜백. 주면 기본 동작(새 탭) 대신 호출. */
  onSelect?: (asset: MediaAsset) => void
  /** 커스텀 fetch. */
  fetch?: typeof fetch
  /** 외부 클라이언트 주입. */
  client?: MediaDeskClient
}

/** 외부에서 갤러리를 새로고침할 수 있는 핸들(업로더와 연동). */
export interface MediaGalleryHandle {
  refresh: () => void
}

type Phase = 'loading' | 'ready' | 'error'

function captionOf(asset: MediaAsset): string {
  const base = asset.key.split('/').pop() ?? asset.key
  return base
}

export const MediaGallery = forwardRef(function MediaGallery(
  props: MediaGalleryProps,
  ref: ForwardedRef<MediaGalleryHandle>
): ReactElement {
  const {
    publishableKey,
    endpoint,
    folder,
    limit = 60,
    thumbSize = 160,
    thumbFormat = 'webp',
    thumbQuality = 70,
    accent = DEFAULT_ACCENT,
    accentInk = DEFAULT_ACCENT_INK,
    showCaptions = true,
    onSelect,
    fetch: customFetch,
    client: injectedClient,
  } = props

  const client = useMemo<MediaDeskClient>(
    () => injectedClient ?? createMediaDeskClient({ publishableKey, endpoint, fetch: customFetch }),
    [injectedClient, publishableKey, endpoint, customFetch]
  )

  const [phase, setPhase] = useState<Phase>('loading')
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [reloadKey, setReloadKey] = useState(0)

  const theme: WidgetTheme = { accent, accentInk }

  useEffect(() => {
    if (typeof document !== 'undefined') ensureStyles()
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    setPhase('loading')
    client
      .listAssets({ folder, limit, signal: ctrl.signal })
      .then((res) => {
        setAssets(res.items)
        setPhase('ready')
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setPhase('error')
      })
    return () => ctrl.abort()
  }, [client, folder, limit, reloadKey])

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])
  useImperativeHandle(ref, () => ({ refresh }), [refresh])

  // 고해상도 화면을 위해 2배 썸네일을 요청(셀은 thumbSize 로 표시).
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1
  const thumbPx = Math.round(thumbSize * dpr)

  const thumbUrl = useCallback(
    (asset: MediaAsset): string =>
      client.buildUrl(asset.key, {
        w: thumbPx,
        h: thumbPx,
        format: asset.transformable ? thumbFormat : undefined,
        q: thumbQuality,
      }),
    [client, thumbPx, thumbFormat, thumbQuality]
  )

  const rootStyle = {
    ...themeVars(theme),
    '--md-cell': `${thumbSize}px`,
  } as CSSProperties

  const handleSelect = (asset: MediaAsset, e: ReactMouseEvent) => {
    if (onSelect) {
      e.preventDefault()
      onSelect(asset)
    }
  }

  return (
    <div className="md-root md-gallery" style={rootStyle} aria-busy={phase === 'loading'}>
      {phase === 'loading' ? (
        <div className="md-state" role="status">
          <span className="md-spinner" aria-hidden="true" />
          <p style={{ margin: 0 }}>자산을 불러오는 중…</p>
        </div>
      ) : null}

      {phase === 'error' ? (
        <div className="md-empty" role="alert">
          <AlertIcon />
          <p>자산을 불러오지 못했어요.</p>
          <div style={{ marginTop: 14 }}>
            <button type="button" className="md-btn md-btn-primary" onClick={refresh}>
              다시 시도
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'ready' && assets.length === 0 ? (
        <div className="md-empty">
          <ImageIcon />
          <p>아직 업로드된 자산이 없어요.</p>
        </div>
      ) : null}

      {phase === 'ready' && assets.length > 0 ? (
        <div className="md-grid" role="list">
          {assets.map((asset) => {
            const isImg = isImageMime(asset.contentType)
            const cap = captionOf(asset)
            return (
              <a
                key={asset.key}
                className="md-cell"
                role="listitem"
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                title={cap}
                onClick={(e) => handleSelect(asset, e)}
              >
                {isImg ? (
                  <img src={thumbUrl(asset)} alt={cap} loading="lazy" decoding="async" />
                ) : (
                  <span className="md-cell-file">
                    <FileIcon />
                    <span>{cap}</span>
                  </span>
                )}
                {showCaptions && isImg ? <span className="md-cell-cap">{cap}</span> : null}
              </a>
            )
          })}
        </div>
      ) : null}
    </div>
  )
})
