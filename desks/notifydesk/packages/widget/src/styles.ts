/**
 * 위젯의 스코프 CSS — 외부 프레임워크 0. 모든 규칙은 `.nd-*` 로 네임스페이스되어
 * 호스트 페이지 스타일과 충돌하지 않습니다. CSS 변수로 accent 만 주입받습니다.
 *
 * 디자인 원칙(준수):
 *  - 그라디언트 텍스트 없음 / 글래스모피즘 없음 / 사이드-스트라이프 보더 없음
 *  - 본문 대비 ≥ 4.5:1 (ink #1a1d23 on #ffffff), 큰 텍스트/배지 ≥ 3:1
 *  - :focus-visible 만 표시(마우스 클릭엔 링 없음), 키보드엔 또렷한 2px 링
 *  - prefers-reduced-motion: 모든 전환/애니메이션을 즉시화
 *  - 시맨틱 z-index 스케일(bell < panel)
 *
 * accent 는 두 형태로 받습니다:
 *  - solid: 배지/포커스 링/버튼
 *  - ink: accent 위 텍스트(대비 보장) — 미지정 시 #ffffff
 */
export interface WidgetTheme {
  accent: string
  accentInk: string
}

export const DEFAULT_ACCENT = '#2f5fe0' // OKLCH ~ L0.52 C0.18 H262 — 흰 텍스트와 대비 충분
export const DEFAULT_ACCENT_INK = '#ffffff'

const STYLE_ID = 'notifydesk-widget-styles'

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
    '--nd-accent': theme.accent,
    '--nd-accent-ink': theme.accentInk,
  }
}

export const WIDGET_CSS = `
.nd-root, .nd-root * { box-sizing: border-box; }
.nd-root {
  --nd-accent: ${DEFAULT_ACCENT};
  --nd-accent-ink: ${DEFAULT_ACCENT_INK};
  --nd-ink: #1a1d23;
  --nd-ink-soft: #4a4f57;
  --nd-muted: #6b7280;
  --nd-surface: #ffffff;
  --nd-surface-2: #f4f5f7;
  --nd-unread: #eef3ff;
  --nd-border: #d7dae0;
  --nd-border-strong: #b7bcc6;
  --nd-danger: #b42318;
  --nd-radius: 14px;
  --nd-radius-sm: 9px;
  --nd-shadow: 0 1px 2px rgba(16,24,40,.06), 0 12px 32px -8px rgba(16,24,40,.22);
  --nd-z-bell: 2147483000;
  --nd-z-panel: 2147483600;
  --nd-ease: cubic-bezier(.22,1,.36,1);
  position: relative;
  display: inline-block;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--nd-ink);
  line-height: 1.5;
}

/* ---- bell 버튼 ---- */
.nd-bell {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--nd-ink-soft);
  cursor: pointer;
  transition: background .14s var(--nd-ease), color .14s var(--nd-ease);
}
.nd-bell:hover { background: var(--nd-surface-2); color: var(--nd-ink); }
.nd-bell[aria-expanded="true"] { background: var(--nd-surface-2); color: var(--nd-ink); }
.nd-bell svg { width: 22px; height: 22px; display: block; }

/* ---- 미읽음 배지 ---- */
.nd-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--nd-accent);
  color: var(--nd-accent-ink);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  border: 2px solid var(--nd-surface);
  pointer-events: none;
}

/* ---- 패널(드롭다운) ---- */
.nd-panel {
  position: absolute;
  z-index: var(--nd-z-panel);
  top: calc(100% + 8px);
  width: min(380px, calc(100vw - 24px));
  max-height: min(520px, calc(100vh - 80px));
  display: flex;
  flex-direction: column;
  background: var(--nd-surface);
  color: var(--nd-ink);
  border: 1px solid var(--nd-border);
  border-radius: var(--nd-radius);
  box-shadow: var(--nd-shadow);
  overflow: hidden;
  animation: nd-pop .18s var(--nd-ease);
}
.nd-align-right { right: 0; }
.nd-align-left { left: 0; }

/* 좁은 화면 — 화면 너비에 맞춰 하단 시트풍으로 */
@media (max-width: 460px) {
  .nd-panel {
    position: fixed;
    left: 12px;
    right: 12px;
    top: auto;
    bottom: 12px;
    width: auto;
    max-height: 80vh;
    animation: nd-sheet .22s var(--nd-ease);
  }
}

.nd-panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--nd-border);
}
.nd-panel-title { margin: 0; font-size: 14px; font-weight: 700; letter-spacing: -0.01em; }
.nd-panel-spacer { flex: 1; }
.nd-mark-all {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--nd-accent);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 7px;
  cursor: pointer;
  transition: background .12s var(--nd-ease);
}
.nd-mark-all:hover:not(:disabled) { background: var(--nd-unread); }
.nd-mark-all:disabled { color: var(--nd-muted); cursor: not-allowed; }
.nd-mark-all svg { width: 15px; height: 15px; }
.nd-panel-close {
  flex: none;
  width: 30px; height: 30px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 7px;
  background: transparent; color: var(--nd-muted);
  cursor: pointer;
  transition: background .12s var(--nd-ease), color .12s var(--nd-ease);
}
.nd-panel-close:hover { background: var(--nd-surface-2); color: var(--nd-ink); }
.nd-panel-close svg { width: 17px; height: 17px; }

/* ---- 목록 ---- */
.nd-list {
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.nd-item {
  position: relative;
  display: flex;
  gap: 10px;
  padding: 12px 16px 12px 16px;
  border-bottom: 1px solid var(--nd-surface-2);
  text-align: left;
  width: 100%;
  border-left: 0;
  border-right: 0;
  border-top: 0;
  background: var(--nd-surface);
  font: inherit;
  color: inherit;
  cursor: pointer;
  transition: background .12s var(--nd-ease);
}
.nd-item:last-child { border-bottom: 0; }
.nd-item:hover { background: var(--nd-surface-2); }
.nd-item.nd-unread { background: var(--nd-unread); }
.nd-item.nd-unread:hover { background: color-mix(in srgb, var(--nd-accent) 12%, var(--nd-surface)); }
.nd-dot {
  flex: none;
  width: 8px; height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--nd-accent);
}
.nd-item.nd-read .nd-dot { background: transparent; }
.nd-item-body { flex: 1; min-width: 0; }
.nd-item-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--nd-ink);
  overflow-wrap: anywhere;
}
.nd-item-text {
  margin: 3px 0 0;
  font-size: 13px;
  color: var(--nd-ink-soft);
  overflow-wrap: anywhere;
}
.nd-item-time { margin: 5px 0 0; font-size: 11px; color: var(--nd-muted); }

/* 시각적으로 숨기되 스크린리더에는 노출(미읽음 등 상태 안내) */
.nd-sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ---- 상태(loading / empty / error) ---- */
.nd-state { padding: 40px 24px; text-align: center; }
.nd-state-icon {
  width: 44px; height: 44px;
  margin: 0 auto 12px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--nd-surface-2);
  color: var(--nd-muted);
}
.nd-state-icon.nd-err {
  background: color-mix(in srgb, var(--nd-danger) 12%, var(--nd-surface));
  color: var(--nd-danger);
}
.nd-state-icon svg { width: 24px; height: 24px; }
.nd-state-title { margin: 0; font-size: 14px; font-weight: 600; }
.nd-state-text { margin: 6px 0 0; font-size: 13px; color: var(--nd-ink-soft); }
.nd-retry {
  margin-top: 14px;
  border: 1px solid var(--nd-border);
  border-radius: var(--nd-radius-sm);
  background: var(--nd-surface);
  color: var(--nd-ink);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  cursor: pointer;
  transition: background .12s var(--nd-ease), border-color .12s var(--nd-ease);
}
.nd-retry:hover { background: var(--nd-surface-2); border-color: var(--nd-border-strong); }

.nd-spinner {
  width: 26px; height: 26px;
  border: 3px solid var(--nd-border);
  border-top-color: var(--nd-accent);
  border-radius: 50%;
  margin: 0 auto;
  animation: nd-spin .7s linear infinite;
}

/* ---- focus-visible: 키보드만 또렷한 링 ---- */
.nd-root :focus { outline: none; }
.nd-root :focus-visible {
  outline: 2px solid var(--nd-accent);
  outline-offset: 2px;
  border-radius: 8px;
}
.nd-item:focus-visible { outline-offset: -2px; }

@keyframes nd-pop { from { opacity: 0; transform: translateY(-6px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes nd-sheet { from { transform: translateY(12px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes nd-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .nd-root *, .nd-panel, .nd-bell, .nd-spinner {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
  .nd-spinner { animation: nd-spin .9s linear infinite !important; }
}
`
