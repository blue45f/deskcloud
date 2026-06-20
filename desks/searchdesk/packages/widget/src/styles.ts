/**
 * 위젯의 스코프 CSS — 외부 프레임워크 0. 모든 규칙은 `.sk-*` 로 네임스페이스되어
 * 호스트 페이지 스타일과 충돌하지 않습니다. CSS 변수로 accent 만 주입받습니다.
 *
 * 디자인 원칙(준수):
 *  - 그라디언트 텍스트 없음 / 기본 글래스모피즘 없음 / 사이드-스트라이프 보더 없음
 *  - 본문 대비 ≥ 4.5:1 (ink #1a1d23 on #ffffff), 큰 텍스트 ≥ 3:1
 *  - :focus-visible 만 표시(마우스 클릭엔 링 없음), 키보드엔 또렷한 2px 링
 *  - prefers-reduced-motion: 모든 전환/애니메이션을 즉시화
 *  - 시맨틱 z-index 스케일(backdrop < dialog)
 *
 * accent 는 두 형태로 받습니다:
 *  - solid: 선택 행 배경/강조
 *  - ink: accent 위 텍스트(대비 보장) — 미지정 시 #ffffff
 */
export interface WidgetTheme {
  accent: string
  accentInk: string
}

export const DEFAULT_ACCENT = '#2f5fe0' // OKLCH ~ L0.52 C0.18 H262 — 흰 텍스트와 대비 충분
export const DEFAULT_ACCENT_INK = '#ffffff'

const STYLE_ID = 'searchdesk-widget-styles'

/** 한 번만 주입(중복 방지). accent 는 CSS 변수라 마운트마다 인라인으로 덮어쓸 수 있음. */
export function ensureStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return
  const el = doc.createElement('style')
  el.id = STYLE_ID
  el.textContent = WIDGET_CSS
  doc.head.appendChild(el)
}

/** 마운트 루트에 줄 인라인 CSS 변수(accent 커스터마이즈). */
export function themeVars(theme: WidgetTheme): Record<string, string> {
  return {
    '--sk-accent': theme.accent,
    '--sk-accent-ink': theme.accentInk,
  }
}

export const WIDGET_CSS = `
.sk-root, .sk-root * { box-sizing: border-box; }
.sk-root {
  --sk-accent: ${DEFAULT_ACCENT};
  --sk-accent-ink: ${DEFAULT_ACCENT_INK};
  --sk-ink: #1a1d23;
  --sk-ink-soft: #4a4f57;
  --sk-muted: #6b7280;
  --sk-surface: #ffffff;
  --sk-surface-2: #f4f5f7;
  --sk-border: #d7dae0;
  --sk-border-strong: #b7bcc6;
  --sk-danger: #b42318;
  --sk-radius: 14px;
  --sk-radius-sm: 9px;
  --sk-shadow: 0 1px 2px rgba(16,24,40,.06), 0 18px 48px -12px rgba(16,24,40,.28);
  --sk-z-backdrop: 2147483600;
  --sk-z-dialog: 2147483601;
  --sk-ease: cubic-bezier(.22,1,.36,1);
  --sk-mark-bg: color-mix(in srgb, var(--sk-accent) 22%, #fff);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--sk-ink);
  line-height: 1.5;
}

/* ---- backdrop + palette dialog ---- */
.sk-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--sk-z-backdrop);
  background: rgba(16,24,40,.42);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12vh 16px 16px;
  animation: sk-fade .16s var(--sk-ease);
}
.sk-dialog {
  position: relative;
  z-index: var(--sk-z-dialog);
  width: min(640px, 100%);
  max-height: min(70vh, 560px);
  display: flex;
  flex-direction: column;
  background: var(--sk-surface);
  color: var(--sk-ink);
  border: 1px solid var(--sk-border);
  border-radius: var(--sk-radius);
  box-shadow: var(--sk-shadow);
  overflow: hidden;
  animation: sk-pop .2s var(--sk-ease);
}
@media (max-width: 520px) {
  .sk-backdrop { padding: 8vh 10px 10px; }
  .sk-dialog { max-height: 84vh; }
}

/* ---- search input row ---- */
.sk-inputbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--sk-border);
}
.sk-inputbar svg.sk-search-icon { width: 20px; height: 20px; color: var(--sk-muted); flex: none; }
.sk-input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 16px;
  color: var(--sk-ink);
  padding: 4px 0;
}
.sk-input::placeholder { color: var(--sk-muted); }
.sk-kbd {
  flex: none;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  color: var(--sk-muted);
  background: var(--sk-surface-2);
  border: 1px solid var(--sk-border);
  border-radius: 6px;
  padding: 2px 7px;
  line-height: 1.4;
}
.sk-mini-spinner {
  width: 16px; height: 16px;
  border: 2px solid var(--sk-border);
  border-top-color: var(--sk-accent);
  border-radius: 50%;
  flex: none;
  animation: sk-spin .7s linear infinite;
}

/* ---- results list ---- */
.sk-results {
  margin: 0;
  padding: 6px;
  list-style: none;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.sk-group-label {
  padding: 10px 12px 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: var(--sk-muted);
}
.sk-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--sk-radius-sm);
  cursor: pointer;
  scroll-margin: 8px;
}
.sk-option-main { flex: 1; min-width: 0; }
.sk-option-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--sk-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sk-option-snippet {
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--sk-ink-soft);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.sk-option-tags {
  display: flex;
  gap: 6px;
  flex: none;
  max-width: 40%;
  overflow: hidden;
}
.sk-tag {
  font-size: 11px;
  color: var(--sk-ink-soft);
  background: var(--sk-surface-2);
  border: 1px solid var(--sk-border);
  border-radius: 999px;
  padding: 1px 8px;
  white-space: nowrap;
}
.sk-enter-hint { flex: none; color: var(--sk-muted); opacity: 0; }
.sk-option[aria-selected="true"] {
  background: color-mix(in srgb, var(--sk-accent) 12%, var(--sk-surface));
}
.sk-option[aria-selected="true"] .sk-enter-hint { opacity: 1; color: var(--sk-accent); }
.sk-option[aria-selected="true"] .sk-option-title { color: var(--sk-accent); }
.sk-option:hover { background: var(--sk-surface-2); }
.sk-option mark, .sk-option-title mark, .sk-option-snippet mark {
  background: var(--sk-mark-bg);
  color: inherit;
  border-radius: 3px;
  padding: 0 1px;
  font-weight: 700;
}

/* ---- states (empty / loading / error / hint) ---- */
.sk-state {
  padding: 44px 24px;
  text-align: center;
  color: var(--sk-ink-soft);
}
.sk-state-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--sk-ink); }
.sk-state-text { margin: 6px 0 0; font-size: 13px; color: var(--sk-muted); }
.sk-state-text strong { color: var(--sk-ink); font-weight: 600; }
.sk-spinner {
  width: 26px; height: 26px;
  border: 3px solid var(--sk-border);
  border-top-color: var(--sk-accent);
  border-radius: 50%;
  margin: 0 auto 12px;
  animation: sk-spin .7s linear infinite;
}

/* ---- footer ---- */
.sk-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-top: 1px solid var(--sk-border);
  font-size: 11px;
  color: var(--sk-muted);
}
.sk-footer-spacer { flex: 1; }
.sk-footer .sk-kbd { font-size: 10px; padding: 1px 5px; }
.sk-foot-key { display: inline-flex; align-items: center; gap: 4px; }
.sk-brand { color: var(--sk-muted); text-decoration: none; font-weight: 600; }
.sk-brand:hover { color: var(--sk-ink-soft); }

/* ---- inline SearchBox variant ---- */
.sk-box { position: relative; width: 100%; }
.sk-box-inputbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid var(--sk-border);
  border-radius: var(--sk-radius-sm);
  background: var(--sk-surface);
  transition: border-color .12s var(--sk-ease), box-shadow .12s var(--sk-ease);
}
.sk-box-inputbar:focus-within {
  border-color: var(--sk-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--sk-accent) 18%, transparent);
}
.sk-box-inputbar svg.sk-search-icon { width: 17px; height: 17px; }
.sk-box .sk-input { font-size: 14px; }
.sk-box-panel {
  position: absolute;
  z-index: var(--sk-z-dialog);
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: 360px;
  display: flex;
  flex-direction: column;
  background: var(--sk-surface);
  border: 1px solid var(--sk-border);
  border-radius: var(--sk-radius);
  box-shadow: var(--sk-shadow);
  overflow: hidden;
  animation: sk-pop .16s var(--sk-ease);
}

/* ---- focus-visible: 키보드만 또렷한 링 ---- */
.sk-root :focus { outline: none; }
.sk-root :focus-visible {
  outline: 2px solid var(--sk-accent);
  outline-offset: 2px;
  border-radius: 6px;
}

@keyframes sk-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes sk-pop { from { opacity: 0; transform: translateY(-6px) scale(.99); } to { opacity: 1; transform: none; } }
@keyframes sk-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .sk-root *, .sk-backdrop, .sk-dialog, .sk-box-panel, .sk-spinner, .sk-mini-spinner {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
  .sk-spinner, .sk-mini-spinner { animation: sk-spin .9s linear infinite !important; }
}
`
