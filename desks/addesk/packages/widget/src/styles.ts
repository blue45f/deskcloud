/**
 * 위젯의 스코프 CSS — 외부 프레임워크 0. 모든 규칙은 `.ad-*` 로 네임스페이스되어
 * 호스트 페이지 스타일과 충돌하지 않습니다. CSS 변수로 accent/radius 만 주입받습니다.
 *
 * 디자인 원칙(준수):
 *  - 그라디언트 텍스트 없음 / 글래스모피즘 없음 / 사이드-스트라이프 보더 없음
 *  - 본문 대비 ≥ 4.5:1
 *  - :focus-visible 만 표시(마우스 클릭엔 링 없음), 키보드엔 또렷한 2px 링
 *  - prefers-reduced-motion: 모든 전환/애니메이션을 즉시화
 */
export interface WidgetTheme {
  accent: string
  radius: string
}

export const DEFAULT_ACCENT = '#2f5fe0' // OKLCH ~ L0.52 C0.18 H262 — 흰 텍스트와 대비 충분
export const DEFAULT_RADIUS = '12px'

const STYLE_ID = 'addesk-widget-styles'

/** 한 번만 주입(중복 방지). accent/radius 는 CSS 변수라 마운트마다 인라인으로 덮어쓸 수 있음. */
export function ensureStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return
  const el = doc.createElement('style')
  el.id = STYLE_ID
  el.textContent = WIDGET_CSS
  doc.head.appendChild(el)
}

/** 마운트 루트에 줄 인라인 CSS 변수(accent/radius 커스터마이즈). */
export function themeVars(theme: WidgetTheme): Record<string, string> {
  return {
    '--ad-accent': theme.accent,
    '--ad-radius': theme.radius,
  }
}

export const WIDGET_CSS = `
.ad-root, .ad-root * { box-sizing: border-box; }
.ad-root {
  --ad-accent: ${DEFAULT_ACCENT};
  --ad-radius: ${DEFAULT_RADIUS};
  --ad-ink: #1a1d23;
  --ad-muted: #6b7280;
  --ad-surface: #ffffff;
  --ad-surface-2: #f4f5f7;
  --ad-border: #d7dae0;
  --ad-ease: cubic-bezier(.22,1,.36,1);
  display: inline-block;
  max-width: 100%;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--ad-ink);
  line-height: 1.4;
}

/* ---- 배너 링크 ---- */
.ad-banner {
  display: block;
  position: relative;
  max-width: 100%;
  border-radius: var(--ad-radius);
  overflow: hidden;
  text-decoration: none;
  background: var(--ad-surface-2);
  transition: box-shadow .14s var(--ad-ease), transform .14s var(--ad-ease);
}
.ad-banner:hover { box-shadow: 0 6px 20px -8px rgba(16,24,40,.35); transform: translateY(-1px); }
.ad-banner img { display: block; width: 100%; height: auto; border: 0; }

/* "광고" 라벨 — 투명성(법규). */
.ad-label {
  position: absolute;
  top: 6px; right: 6px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .02em;
  color: #fff;
  background: rgba(20,24,33,.62);
  border-radius: 999px;
  pointer-events: none;
}

/* ---- 플레이스홀더(로딩) ---- */
.ad-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--ad-radius);
  background: var(--ad-surface-2);
  color: var(--ad-muted);
  border: 1px solid var(--ad-border);
  min-height: 60px;
  font-size: 12px;
}
.ad-skeleton {
  position: relative;
  overflow: hidden;
  background: var(--ad-surface-2);
}
.ad-skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
  transform: translateX(-100%);
  animation: ad-shimmer 1.2s infinite;
}
@keyframes ad-shimmer { to { transform: translateX(100%); } }

.ad-root :focus { outline: none; }
.ad-root :focus-visible {
  outline: 2px solid var(--ad-accent);
  outline-offset: 2px;
  border-radius: 6px;
}

@media (prefers-reduced-motion: reduce) {
  .ad-root *, .ad-banner, .ad-skeleton::after {
    transition-duration: .001ms !important;
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
  }
}
`
