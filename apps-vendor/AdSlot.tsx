/**
 * AdDesk — 단일 파일 벤더링 컴포넌트 (의존성: react 만).
 * ──────────────────────────────────────────────────────────────────────────
 * npm publish 가 막힌 동안 형제/외부 앱에 그대로 복붙해서 쓰는 버전입니다.
 * 워크스페이스 의존(@addesk/shared·@addesk/widget) 0 — 필요한 클라이언트 로직(서빙·노출/클릭
 * 추적)과 스타일을 이 파일에 인라인했습니다. 동작/디자인은 @addesk/widget 의 <AdSlot> 와 동일합니다.
 *
 * 사용:
 *   import { AdSlot } from './AdSlot'
 *   <AdSlot slot="sidebar" publishableKey="pk_…" endpoint="https://ads.example.com" />
 *
 * 백엔드 계약(공개·publishable 키):
 *   GET  {endpoint}/api/ads/serve?slot=…   (Bearer pk_)  → { served, creativeId, imageUrl, linkUrl, alt, size }
 *   POST {endpoint}/api/ads/impression     (Bearer pk_, { creativeId })
 *   POST {endpoint}/api/ads/click          (Bearer pk_, { creativeId })
 *
 * 접근성/디자인: focus-visible · prefers-reduced-motion · 대비 ≥4.5:1 ·
 * 그라디언트 텍스트/글래스모피즘/사이드스트라이프 없음 · 외부 CSS 프레임워크 0.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'

/* ============================ 계약(인라인) ============================ */

const WIDGET_VERSION = '0.1.0'

export interface ServeResult {
  served: boolean
  creativeId: string | null
  imageUrl: string | null
  linkUrl: string | null
  alt: string | null
  size: string | null
}

class AdDeskError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'AdDeskError'
  }
}

function messageFromBody(body: unknown, status: number): string {
  const rec = (body ?? {}) as Record<string, unknown>
  const raw = rec.message ?? rec.error ?? `AdDesk 요청 실패 (${status})`
  return Array.isArray(raw) ? raw.join(', ') : String(raw)
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/* ============================ 클라이언트(인라인) ============================ */

async function call<T>(
  base: string,
  publishableKey: string,
  method: 'GET' | 'POST',
  path: string,
  opts: { body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${publishableKey}`,
    'X-PK': publishableKey,
    'X-AdDesk-Widget': WIDGET_VERSION,
  }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    signal: opts.signal,
  })
  const text = await res.text()
  const body: unknown = text ? safeJson(text) : null
  if (!res.ok) throw new AdDeskError(messageFromBody(body, res.status), res.status)
  return body as T
}

/* ============================ 스타일(인라인) ============================ */

const DEFAULT_ACCENT = '#2f5fe0'
const STYLE_ID = 'addesk-vendor-styles'

function ensureStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
}

/* ============================ 컴포넌트 ============================ */

export interface AdSlotProps {
  slot: string
  publishableKey: string
  endpoint: string
  accent?: string
  radius?: string
  showSkeleton?: boolean
  fallback?: ReactElement | null
  onImpression?: (creativeId: string) => void
  onClick?: (creativeId: string) => void
  onError?: (error: Error) => void
}

type Phase = 'loading' | 'served' | 'empty' | 'error'

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
    radius = '12px',
    showSkeleton = true,
    fallback = null,
    onImpression,
    onClick,
    onError,
  } = props

  const base = endpoint.replace(/\/+$/, '')
  const [phase, setPhase] = useState<Phase>('loading')
  const [ad, setAd] = useState<ServeResult | null>(null)

  ensureStyles()

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setPhase('loading')
    setAd(null)

    call<ServeResult>(base, publishableKey, 'GET', `/api/ads/serve?slot=${encodeURIComponent(slot)}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!active) return
        if (result.served && result.creativeId) {
          setAd(result)
          setPhase('served')
          call(base, publishableKey, 'POST', '/api/ads/impression', {
            body: { creativeId: result.creativeId },
          }).catch((err: unknown) => onError?.(err instanceof Error ? err : new Error(String(err))))
          onImpression?.(result.creativeId)
        } else {
          setPhase('empty')
        }
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return
        setPhase('error')
        onError?.(err instanceof Error ? err : new Error(String(err)))
      })

    return () => {
      active = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, publishableKey, slot])

  const dims = parseSize(ad?.size ?? null)
  const rootStyle = { '--adv-accent': accent, '--adv-radius': radius } as CSSProperties

  const handleClick = (): void => {
    if (!ad?.creativeId) return
    call(base, publishableKey, 'POST', '/api/ads/click', {
      body: { creativeId: ad.creativeId },
    }).catch((err: unknown) => onError?.(err instanceof Error ? err : new Error(String(err))))
    onClick?.(ad.creativeId)
  }

  if (phase === 'loading') {
    if (!showSkeleton) return null
    return (
      <div className="adv-root" style={rootStyle}>
        <div
          className="adv-placeholder adv-skeleton"
          style={dims ? { width: dims.width, height: dims.height, maxWidth: '100%' } : undefined}
          aria-hidden="true"
        />
      </div>
    )
  }

  if (phase === 'served' && ad?.imageUrl && ad.linkUrl) {
    return (
      <div className="adv-root" style={rootStyle}>
        <a
          className="adv-banner"
          href={ad.linkUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={handleClick}
          style={dims ? { width: dims.width, maxWidth: '100%' } : undefined}
        >
          <img src={ad.imageUrl} alt={ad.alt ?? '광고'} width={dims?.width} height={dims?.height} loading="lazy" />
          <span className="adv-label">광고</span>
        </a>
      </div>
    )
  }

  return fallback
}

const CSS = `
.adv-root, .adv-root * { box-sizing: border-box; }
.adv-root {
  --adv-accent: ${DEFAULT_ACCENT};
  --adv-radius: 12px;
  --adv-surface-2: #f4f5f7; --adv-border: #d7dae0;
  display: inline-block; max-width: 100%;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.adv-banner {
  display: block; position: relative; max-width: 100%;
  border-radius: var(--adv-radius); overflow: hidden; text-decoration: none;
  background: var(--adv-surface-2);
  transition: box-shadow .14s, transform .14s;
}
.adv-banner:hover { box-shadow: 0 6px 20px -8px rgba(16,24,40,.35); transform: translateY(-1px); }
.adv-banner img { display: block; width: 100%; height: auto; border: 0; }
.adv-label {
  position: absolute; top: 6px; right: 6px;
  padding: 1px 6px; font-size: 10px; font-weight: 600; letter-spacing: .02em;
  color: #fff; background: rgba(20,24,33,.62); border-radius: 999px; pointer-events: none;
}
.adv-placeholder {
  border-radius: var(--adv-radius); background: var(--adv-surface-2);
  border: 1px solid var(--adv-border); min-height: 60px; min-width: 120px;
}
.adv-skeleton { position: relative; overflow: hidden; }
.adv-skeleton::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
  transform: translateX(-100%); animation: adv-shimmer 1.2s infinite;
}
@keyframes adv-shimmer { to { transform: translateX(100%); } }
.adv-root :focus { outline: none; }
.adv-root :focus-visible { outline: 2px solid var(--adv-accent); outline-offset: 2px; border-radius: 6px; }
@media (prefers-reduced-motion: reduce) {
  .adv-root *, .adv-banner, .adv-skeleton::after { transition-duration: .001ms !important; animation-duration: .001ms !important; animation-iteration-count: 1 !important; }
}
`
