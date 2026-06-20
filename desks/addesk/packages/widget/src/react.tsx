/**
 * @addesk/widget/react — <AdSlot> 컴포넌트.
 *
 * 슬롯(slot)에 노출할 활성 크리에이티브를 publishable(pk_) 키로 서빙받아 추적 배너로 렌더한다.
 *  - 마운트 시 GET /api/ads/serve?slot= 으로 가중 선택된 크리에이티브를 받는다.
 *  - 노출은 IAB 류 가시성 기준(뷰포트에 ≥50% 가 ≥1초)으로 1회 추적한다 — IntersectionObserver 로
 *    실제로 "보여진" 광고만 센다. IO 미지원 환경(SSR/구형/테스트)에서는 서빙 직후 즉시 추적으로 폴백.
 *  - 클릭 시 POST /api/ads/click 을 보내고(비차단) 링크로 이동한다(새 탭, rel=noopener).
 *  - 적합한 광고가 없으면(served:false) 아무것도 그리지 않는다(빈 슬롯 깔끔).
 *
 * 의존성은 react(peer)뿐. 외부 CSS 프레임워크 0(스코프 .ad-* 스타일).
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react'

import { createAdDeskClient, type AdDeskClient } from './client'
import { ImageIcon } from './icons'
import { DEFAULT_ACCENT, DEFAULT_RADIUS, ensureStyles, themeVars } from './styles'

import type { ServeDto } from '@addesk/shared'

export interface AdSlotProps {
  /** 슬롯 key(지면). 예: 'sidebar'. */
  slot: string
  /** publishable 키(`pk_…`). 브라우저 노출 안전. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://ads.example.com'. */
  endpoint: string
  /** 강조색(포커스 링). 기본 #2f5fe0. */
  accent?: string
  /** 모서리 둥글기. 기본 12px. */
  radius?: string
  /** 로딩 중 스켈레톤 표시. 기본 true. */
  showSkeleton?: boolean
  /** 빈 슬롯(광고 없음) 시 렌더할 대체 요소(기본 아무것도 안 그림). */
  fallback?: ReactElement | null
  /**
   * 가시성 기반 노출 추적 설정(IAB 류). 기본 켜짐(50% 가 1000ms 보이면 1회 추적).
   * `false` 로 끄면 서빙 직후 즉시 추적(레거시 동작). IntersectionObserver 미지원 환경은 항상 즉시 폴백.
   */
  viewability?: ViewabilityConfig | false
  /** 노출 콜백(노출이 실제로 카운트되는 시점에 호출 — 가시성 게이트 통과 시). */
  onImpression?: (creativeId: string) => void
  /** 클릭 콜백. */
  onClick?: (creativeId: string) => void
  /** 에러 콜백. */
  onError?: (error: Error) => void
  /** 커스텀 fetch(SSR/테스트). */
  fetch?: typeof fetch
  /** 외부에서 만든 클라이언트 주입(테스트/공유용). */
  client?: AdDeskClient
}

type Phase = 'loading' | 'served' | 'empty' | 'error'

/** 가시성(viewability) 기준 — IAB 표준(디스플레이: 50% 가 1초). */
export interface ViewabilityConfig {
  /** 보여야 하는 면적 비율(0~1). 기본 0.5(50%). */
  threshold?: number
  /** 그 비율이 연속으로 유지돼야 하는 시간(ms). 기본 1000(1초). */
  durationMs?: number
}

/** IAB 디스플레이 광고 기본값(50% 면적 · 1초). */
const DEFAULT_VIEWABILITY: Required<ViewabilityConfig> = { threshold: 0.5, durationMs: 1000 }

/** 이 환경이 가시성 게이트(IntersectionObserver)를 지원하는지. */
function supportsIntersectionObserver(): boolean {
  return typeof IntersectionObserver !== 'undefined'
}

/** "300x250" → {width, height}. 파싱 실패 시 undefined. */
function parseSize(size: string | null): { width: number; height: number } | undefined {
  if (!size) return undefined
  const m = /^(\d+)x(\d+)$/.exec(size)
  if (!m) return undefined
  return { width: Number(m[1]), height: Number(m[2]) }
}

export function AdSlot(props: AdSlotProps): ReactElement | null {
  const {
    slot,
    publishableKey,
    endpoint,
    accent = DEFAULT_ACCENT,
    radius = DEFAULT_RADIUS,
    showSkeleton = true,
    fallback = null,
    viewability = DEFAULT_VIEWABILITY,
    onImpression,
    onClick,
    onError,
    fetch: customFetch,
    client: injectedClient,
  } = props

  const client = useMemo<AdDeskClient>(
    () => injectedClient ?? createAdDeskClient({ publishableKey, endpoint, fetch: customFetch }),
    [injectedClient, publishableKey, endpoint, customFetch]
  )

  // 응답을 "어떤 요청(client·slot)의 결과인지" 태그와 함께 보관한다. 렌더에서 태그가 현재
  // client/slot 과 일치하지 않으면 아직 로딩 중으로 파생한다 — effect 내 동기 setState 없이
  // (서빙 1회 + 깨끗한 리셋)을 만족하는 React 19 권장 패턴.
  const [resolved, setResolved] = useState<{
    client: AdDeskClient
    slot: string
    outcome: 'served' | 'empty' | 'error'
    ad: ServeDto | null
  } | null>(null)

  // 콜백을 ref 에 보관(effect 안에서만 읽음 — 렌더 중 접근 아님). 콜백 정체성이 매 렌더 바뀌어도
  // 서빙 effect 가 재실행되지 않도록 한다(슬롯당 서빙 1회 보장).
  const callbacks = useRef({ onImpression, onError })
  useEffect(() => {
    callbacks.current = { onImpression, onError }
  }, [onImpression, onError])

  // 노출은 (client, slot, creativeId) 조합당 정확히 1회만 추적한다. 가시성 게이트가 다시 트리거되거나
  // 재렌더돼도 중복 카운트하지 않도록 마지막으로 추적한 키를 ref 에 기록한다.
  const impressionKey = useRef<string | null>(null)
  const fireImpression = useCallback(
    (forClient: AdDeskClient, forSlot: string, creativeId: string): void => {
      const key = `${forSlot}::${creativeId}`
      if (impressionKey.current === key) return
      impressionKey.current = key
      // 노출 추적(비차단) — 실패는 조용히 무시(에러 콜백만).
      forClient.trackImpression(creativeId).catch((err: unknown) => {
        callbacks.current.onError?.(err instanceof Error ? err : new Error(String(err)))
      })
      callbacks.current.onImpression?.(creativeId)
    },
    []
  )

  if (typeof document !== 'undefined') ensureStyles()

  // 마운트(및 slot/client 변경) 시 서빙 요청. AbortController 로 정리. 노출 추적은 가시성 게이트가
  // 담당하되(IO), IO 미지원 환경은 서빙 직후 즉시 추적으로 폴백(레거시 동작 보존).
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    impressionKey.current = null

    client
      .serve(slot, controller.signal)
      .then((result) => {
        if (!active) return
        if (result.served && result.creativeId) {
          setResolved({ client, slot, outcome: 'served', ad: result })
          // 가시성 게이트를 못 쓰면(SSR/구형/IO off) 즉시 추적 — 그 외엔 IO effect 가 담당.
          if (viewability === false || !supportsIntersectionObserver()) {
            fireImpression(client, slot, result.creativeId)
          }
        } else {
          setResolved({ client, slot, outcome: 'empty', ad: null })
        }
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return
        setResolved({ client, slot, outcome: 'error', ad: null })
        callbacks.current.onError?.(err instanceof Error ? err : new Error(String(err)))
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [client, slot, viewability, fireImpression])

  // 현재 client/slot 의 결과만 유효 — 그 외엔 로딩(파생).
  const current = resolved && resolved.client === client && resolved.slot === slot ? resolved : null
  const phase: Phase = current ? current.outcome : 'loading'
  const ad = current?.ad ?? null

  // 렌더된 배너 요소 — 가시성 게이트(IntersectionObserver)가 관찰한다.
  const bannerRef = useRef<HTMLAnchorElement | null>(null)
  const servedCreativeId = phase === 'served' ? (ad?.creativeId ?? null) : null
  const vizThreshold =
    viewability === false ? 0 : (viewability.threshold ?? DEFAULT_VIEWABILITY.threshold)
  const vizDuration =
    viewability === false ? 0 : (viewability.durationMs ?? DEFAULT_VIEWABILITY.durationMs)

  // 가시성 기반 노출 — 배너가 화면에 threshold(기본 50%)만큼 durationMs(기본 1초) 보이면 1회 추적.
  // IO 미지원/끔이면 서빙 effect 가 이미 즉시 추적했으므로 여기서는 아무것도 하지 않는다.
  useEffect(() => {
    if (viewability === false || !supportsIntersectionObserver()) return
    if (!servedCreativeId) return
    const el = bannerRef.current
    if (!el) return

    let timer: ReturnType<typeof setTimeout> | undefined
    const clear = (): void => {
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        // threshold 이상 보이면 durationMs 동안 유지되는지 타이머 시작 — 도중에 벗어나면 취소.
        if (entry.isIntersecting && entry.intersectionRatio >= vizThreshold) {
          if (timer === undefined) {
            timer = setTimeout(() => {
              fireImpression(client, slot, servedCreativeId)
              observer.disconnect()
            }, vizDuration)
          }
        } else {
          clear()
        }
      },
      // 0·threshold 양쪽을 관찰해 진입/이탈 콜백을 모두 받는다.
      { threshold: [0, Math.min(Math.max(vizThreshold, 0.01), 1)] }
    )
    observer.observe(el)
    return () => {
      clear()
      observer.disconnect()
    }
  }, [client, slot, servedCreativeId, viewability, vizThreshold, vizDuration, fireImpression])

  const dims = parseSize(ad?.size ?? null)
  const rootStyle = { ...themeVars({ accent, radius }) } as CSSProperties

  const handleClick = (): void => {
    if (!ad?.creativeId) return
    // 클릭 추적(비차단). 새 탭으로 열리므로 네비게이션을 막지 않는다(preventDefault 안 함).
    client.trackClick(ad.creativeId).catch((err: unknown) => {
      onError?.(err instanceof Error ? err : new Error(String(err)))
    })
    onClick?.(ad.creativeId)
  }

  if (phase === 'loading') {
    if (!showSkeleton) return null
    return (
      <div className="ad-root" style={rootStyle}>
        <div
          className="ad-placeholder ad-skeleton"
          style={dims ? { width: dims.width, height: dims.height, maxWidth: '100%' } : undefined}
          aria-hidden="true"
        >
          <ImageIcon />
        </div>
      </div>
    )
  }

  if (phase === 'served' && ad?.imageUrl && ad.linkUrl) {
    return (
      <div className="ad-root" style={rootStyle}>
        <a
          ref={bannerRef}
          className="ad-banner"
          href={ad.linkUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={handleClick}
          style={dims ? { width: dims.width, maxWidth: '100%' } : undefined}
        >
          <img
            src={ad.imageUrl}
            alt={ad.alt ?? '광고'}
            width={dims?.width}
            height={dims?.height}
            loading="lazy"
          />
          <span className="ad-label">광고</span>
        </a>
      </div>
    )
  }

  // empty / error — 대체 요소(기본 null).
  return fallback
}
