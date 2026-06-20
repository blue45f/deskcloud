/**
 * 위젯의 스코프 CSS — 외부 프레임워크 0. 모든 규칙은 `.cd-*` 로 네임스페이스되어
 * 호스트 페이지 스타일과 충돌하지 않습니다. CSS 변수로 accent 만 주입받습니다.
 *
 * 디자인 원칙(준수):
 *  - 그라디언트 텍스트 없음 / 기본 글래스모피즘 없음 / 사이드-스트라이프 보더 없음
 *  - 본문 대비 ≥ 4.5:1 (ink #1a1d23 on #ffffff), 큰 텍스트 ≥ 3:1
 *  - :focus-visible 만 표시(마우스 클릭엔 링 없음), 키보드엔 또렷한 2px 링
 *  - prefers-reduced-motion: 모든 전환/애니메이션을 즉시화
 *  - 시맨틱 z-index 스케일(launcher < backdrop < panel)
 *
 * accent 는 두 형태로 받습니다:
 *  - solid: 버튼/배지 배경
 *  - ink: accent 위 텍스트(대비 보장) — 미지정 시 #ffffff
 */
export interface WidgetTheme {
  accent: string
  accentInk: string
}

export const DEFAULT_ACCENT = '#2f5fe0' // OKLCH ~ L0.52 C0.18 H262 — 흰 텍스트와 대비 충분
export const DEFAULT_ACCENT_INK = '#ffffff'

const STYLE_ID = 'changelogdesk-widget-styles'

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
    '--cd-accent': theme.accent,
    '--cd-accent-ink': theme.accentInk,
  }
}

export const WIDGET_CSS = `
.cd-root, .cd-root * { box-sizing: border-box; }
.cd-root {
  --cd-accent: ${DEFAULT_ACCENT};
  --cd-accent-ink: ${DEFAULT_ACCENT_INK};
  --cd-ink: #1a1d23;
  --cd-ink-soft: #4a4f57;
  --cd-muted: #6b7280;
  --cd-surface: #ffffff;
  --cd-surface-2: #f4f5f7;
  --cd-border: #d7dae0;
  --cd-border-strong: #b7bcc6;
  --cd-danger: #b42318;
  --cd-tag-new-bg: #e7f0ff;   --cd-tag-new-ink: #1c47b0;
  --cd-tag-imp-bg: #e6f6ec;   --cd-tag-imp-ink: #0a6b3b;
  --cd-tag-fix-bg: #fdeceb;   --cd-tag-fix-ink: #a4291f;
  --cd-tag-ann-bg: #f1ecfb;   --cd-tag-ann-ink: #5a32a3;
  --cd-radius: 14px;
  --cd-radius-sm: 9px;
  --cd-shadow: 0 1px 2px rgba(16,24,40,.06), 0 12px 32px -8px rgba(16,24,40,.22);
  --cd-z-launcher: 2147483000;
  --cd-z-backdrop: 2147483600;
  --cd-z-panel: 2147483601;
  --cd-ease: cubic-bezier(.22,1,.36,1);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--cd-ink);
  line-height: 1.5;
}

/* ---- launcher 벨 버튼 + 미읽음 배지 ---- */
.cd-launcher {
  position: fixed;
  z-index: var(--cd-z-launcher);
  width: 52px;
  height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: var(--cd-accent);
  color: var(--cd-accent-ink);
  cursor: pointer;
  box-shadow: var(--cd-shadow);
  transition: transform .18s var(--cd-ease), filter .18s var(--cd-ease);
}
.cd-launcher:hover { filter: brightness(1.06); transform: translateY(-1px); }
.cd-launcher:active { transform: translateY(0); }
.cd-launcher svg { width: 24px; height: 24px; display: block; }
.cd-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--cd-danger);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  border: 2px solid var(--cd-surface);
}
.cd-pos-br { right: 20px; bottom: 20px; }
.cd-pos-bl { left: 20px; bottom: 20px; }
.cd-pos-tr { right: 20px; top: 20px; }
.cd-pos-tl { left: 20px; top: 20px; }

/* ---- backdrop(클릭 외 닫기) + panel ---- */
.cd-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--cd-z-backdrop);
  background: transparent;
}
.cd-panel {
  position: fixed;
  z-index: var(--cd-z-panel);
  width: min(400px, calc(100vw - 32px));
  max-height: min(560px, calc(100vh - 96px));
  display: flex;
  flex-direction: column;
  background: var(--cd-surface);
  color: var(--cd-ink);
  border: 1px solid var(--cd-border);
  border-radius: var(--cd-radius);
  box-shadow: var(--cd-shadow);
  overflow: hidden;
  animation: cd-pop .18s var(--cd-ease);
}
.cd-panel.cd-pos-br { right: 20px; bottom: 84px; }
.cd-panel.cd-pos-bl { left: 20px; bottom: 84px; }
.cd-panel.cd-pos-tr { right: 20px; top: 84px; }
.cd-panel.cd-pos-tl { left: 20px; top: 84px; }

/* 좁은 화면 → 하단 시트 */
@media (max-width: 480px) {
  .cd-panel, .cd-panel.cd-pos-br, .cd-panel.cd-pos-bl, .cd-panel.cd-pos-tr, .cd-panel.cd-pos-tl {
    left: 0; right: 0; bottom: 0; top: auto;
    width: 100vw;
    max-height: 88vh;
    border-radius: 18px 18px 0 0;
    animation: cd-sheet .24s var(--cd-ease);
  }
}

.cd-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid var(--cd-border);
  flex: none;
}
.cd-header-text { flex: 1; min-width: 0; }
.cd-title { margin: 0; font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
.cd-subtitle { margin: 2px 0 0; font-size: 12px; color: var(--cd-muted); }
.cd-close {
  flex: none;
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 8px;
  background: transparent;
  color: var(--cd-muted);
  cursor: pointer;
  transition: background .14s var(--cd-ease), color .14s var(--cd-ease);
}
.cd-close:hover { background: var(--cd-surface-2); color: var(--cd-ink); }
.cd-close svg { width: 18px; height: 18px; }

.cd-body { padding: 6px 0; overflow-y: auto; -webkit-overflow-scrolling: touch; flex: 1; }

/* ---- 항목 ---- */
.cd-entry { padding: 14px 18px; border-bottom: 1px solid var(--cd-surface-2); }
.cd-entry:last-child { border-bottom: 0; }
.cd-entry-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.cd-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .01em;
  text-transform: capitalize;
}
.cd-tag-new { background: var(--cd-tag-new-bg); color: var(--cd-tag-new-ink); }
.cd-tag-improved { background: var(--cd-tag-imp-bg); color: var(--cd-tag-imp-ink); }
.cd-tag-fixed { background: var(--cd-tag-fix-bg); color: var(--cd-tag-fix-ink); }
.cd-tag-announcement { background: var(--cd-tag-ann-bg); color: var(--cd-tag-ann-ink); }
.cd-ver {
  font-size: 11px;
  font-weight: 600;
  color: var(--cd-ink-soft);
  background: var(--cd-surface-2);
  padding: 2px 7px;
  border-radius: 6px;
}
.cd-date { font-size: 11px; color: var(--cd-muted); margin-left: auto; }
.cd-entry-title { margin: 0 0 4px; font-size: 14px; font-weight: 700; letter-spacing: -0.01em; }

/* 마크다운 본문(서버 새니타이즈 HTML) */
.cd-md { font-size: 13px; color: var(--cd-ink-soft); }
.cd-md > :first-child { margin-top: 0; }
.cd-md > :last-child { margin-bottom: 0; }
.cd-md p { margin: 6px 0; }
.cd-md h1, .cd-md h2, .cd-md h3, .cd-md h4, .cd-md h5, .cd-md h6 {
  margin: 10px 0 4px; font-size: 13px; font-weight: 700; color: var(--cd-ink);
}
.cd-md ul, .cd-md ol { margin: 6px 0; padding-left: 20px; }
.cd-md li { margin: 2px 0; }
.cd-md a { color: var(--cd-accent); text-decoration: underline; }
.cd-md code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  background: var(--cd-surface-2);
  padding: 1px 5px;
  border-radius: 5px;
}
.cd-md pre {
  background: var(--cd-surface-2);
  padding: 10px 12px;
  border-radius: var(--cd-radius-sm);
  overflow-x: auto;
  margin: 8px 0;
}
.cd-md pre code { background: transparent; padding: 0; }
.cd-md strong { color: var(--cd-ink); }

/* ---- 푸터 / 더 보기 ---- */
.cd-footer {
  flex: none;
  padding: 10px 18px;
  border-top: 1px solid var(--cd-border);
  display: flex;
  align-items: center;
  gap: 10px;
}
.cd-brand { font-size: 11px; color: var(--cd-muted); text-decoration: none; }
.cd-brand:hover { color: var(--cd-ink-soft); }
.cd-footer-spacer { flex: 1; }
.cd-more {
  appearance: none;
  border: 1px solid var(--cd-border);
  border-radius: var(--cd-radius-sm);
  background: var(--cd-surface);
  color: var(--cd-ink-soft);
  padding: 7px 14px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background .14s var(--cd-ease), border-color .14s var(--cd-ease);
}
.cd-more:hover:not(:disabled) { background: var(--cd-surface-2); border-color: var(--cd-border-strong); }
.cd-more:disabled { opacity: .55; cursor: not-allowed; }

/* ---- states (loading / empty / error) ---- */
.cd-state { padding: 44px 24px; text-align: center; }
.cd-state-icon {
  width: 48px; height: 48px;
  margin: 0 auto 12px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--cd-surface-2);
  color: var(--cd-muted);
}
.cd-state-icon.cd-err { background: color-mix(in srgb, var(--cd-danger) 12%, var(--cd-surface)); color: var(--cd-danger); }
.cd-state-icon svg { width: 26px; height: 26px; }
.cd-state-title { margin: 0; font-size: 15px; font-weight: 700; }
.cd-state-text { margin: 6px 0 0; font-size: 13px; color: var(--cd-ink-soft); }
.cd-retry {
  margin-top: 16px;
  appearance: none;
  border: 0;
  border-radius: var(--cd-radius-sm);
  background: var(--cd-accent);
  color: var(--cd-accent-ink);
  padding: 9px 18px;
  font: inherit;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: filter .14s var(--cd-ease);
}
.cd-retry:hover { filter: brightness(1.06); }

.cd-spinner {
  width: 26px; height: 26px;
  border: 3px solid var(--cd-border);
  border-top-color: var(--cd-accent);
  border-radius: 50%;
  margin: 0 auto;
  animation: cd-spin .7s linear infinite;
}

/* 스켈레톤(로딩) */
.cd-skeleton { padding: 14px 18px; border-bottom: 1px solid var(--cd-surface-2); }
.cd-sk-line {
  height: 11px;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--cd-surface-2) 25%, #eceef1 37%, var(--cd-surface-2) 63%);
  background-size: 400% 100%;
  animation: cd-shimmer 1.3s ease infinite;
  margin: 8px 0;
}

/* ---- focus-visible: 키보드만 또렷한 링 ---- */
.cd-root :focus { outline: none; }
.cd-root :focus-visible {
  outline: 2px solid var(--cd-accent);
  outline-offset: 2px;
  border-radius: 6px;
}

@keyframes cd-pop { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes cd-sheet { from { transform: translateY(100%); } to { transform: none; } }
@keyframes cd-spin { to { transform: rotate(360deg); } }
@keyframes cd-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

@media (prefers-reduced-motion: reduce) {
  .cd-root *, .cd-backdrop, .cd-panel, .cd-launcher, .cd-spinner, .cd-sk-line {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
  .cd-spinner { animation: cd-spin .9s linear infinite !important; }
  .cd-sk-line { animation: none !important; background: var(--cd-surface-2) !important; }
}
`
