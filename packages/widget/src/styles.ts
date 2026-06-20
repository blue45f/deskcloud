/**
 * 위젯의 스코프 CSS — 외부 프레임워크 0. 모든 규칙은 `.md-*` 로 네임스페이스되어
 * 호스트 페이지 스타일과 충돌하지 않습니다. CSS 변수로 accent 만 주입받습니다.
 *
 * 디자인 원칙(준수):
 *  - 그라디언트 텍스트 없음 / 글래스모피즘 없음 / 사이드-스트라이프 보더 없음
 *  - 본문 대비 ≥ 4.5:1 (ink #1a1d23 on #ffffff), 큰 텍스트 ≥ 3:1
 *  - :focus-visible 만 표시(마우스 클릭엔 링 없음), 키보드엔 또렷한 2px 링
 *  - prefers-reduced-motion: 모든 전환/애니메이션을 즉시화
 */
export interface WidgetTheme {
  accent: string
  accentInk: string
}

export const DEFAULT_ACCENT = '#2f5fe0' // OKLCH ~ L0.52 C0.18 H262 — 흰 텍스트와 대비 충분
export const DEFAULT_ACCENT_INK = '#ffffff'

const STYLE_ID = 'mediadesk-widget-styles'

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
    '--md-accent': theme.accent,
    '--md-accent-ink': theme.accentInk,
  }
}

export const WIDGET_CSS = `
.md-root, .md-root * { box-sizing: border-box; }
.md-root {
  --md-accent: ${DEFAULT_ACCENT};
  --md-accent-ink: ${DEFAULT_ACCENT_INK};
  --md-ink: #1a1d23;
  --md-ink-soft: #4a4f57;
  --md-muted: #6b7280;
  --md-surface: #ffffff;
  --md-surface-2: #f4f5f7;
  --md-surface-3: #eceef1;
  --md-border: #d7dae0;
  --md-border-strong: #b7bcc6;
  --md-danger: #b42318;
  --md-success: #047857;
  --md-radius: 14px;
  --md-radius-sm: 9px;
  --md-shadow: 0 1px 2px rgba(16,24,40,.06), 0 8px 24px -10px rgba(16,24,40,.18);
  --md-ease: cubic-bezier(.22,1,.36,1);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--md-ink);
  line-height: 1.5;
}

/* ============================ Uploader ============================ */
.md-uploader { display: flex; flex-direction: column; gap: 14px; }

.md-drop {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  padding: 32px 20px;
  border: 2px dashed var(--md-border-strong);
  border-radius: var(--md-radius);
  background: var(--md-surface-2);
  color: var(--md-ink-soft);
  cursor: pointer;
  transition: border-color .15s var(--md-ease), background .15s var(--md-ease), color .15s var(--md-ease);
}
.md-drop:hover { border-color: var(--md-accent); color: var(--md-ink); }
.md-drop.md-dragging {
  border-color: var(--md-accent);
  background: color-mix(in srgb, var(--md-accent) 8%, var(--md-surface));
  color: var(--md-ink);
}
.md-drop.md-disabled { opacity: .6; cursor: not-allowed; }
.md-drop-icon {
  width: 44px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--md-surface);
  color: var(--md-accent);
  box-shadow: var(--md-shadow);
}
.md-drop-icon svg { width: 24px; height: 24px; }
.md-drop-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--md-ink); }
.md-drop-hint { margin: 0; font-size: 12px; color: var(--md-muted); }
.md-drop-cta { color: var(--md-accent); font-weight: 600; text-decoration: underline; }
.md-visually-hidden {
  position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

/* ---- queued / uploaded item ---- */
.md-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.md-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--md-border);
  border-radius: var(--md-radius-sm);
  background: var(--md-surface);
}
.md-item-thumb {
  flex: none;
  width: 48px; height: 48px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--md-surface-3);
  display: flex; align-items: center; justify-content: center;
  color: var(--md-muted);
}
.md-item-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.md-item-thumb svg { width: 22px; height: 22px; }
.md-item-main { flex: 1; min-width: 0; }
.md-item-name {
  margin: 0;
  font-size: 13px; font-weight: 600; color: var(--md-ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.md-item-meta { margin: 2px 0 0; font-size: 11px; color: var(--md-muted); }
.md-item-meta.md-err { color: var(--md-danger); }
.md-item-status { flex: none; display: flex; align-items: center; gap: 8px; }

.md-progress {
  width: 100%; height: 5px;
  margin-top: 7px;
  border-radius: 999px;
  background: var(--md-surface-3);
  overflow: hidden;
}
.md-progress-bar {
  height: 100%;
  background: var(--md-accent);
  border-radius: 999px;
  transition: width .18s var(--md-ease);
}

.md-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 50%;
}
.md-badge.md-ok { background: color-mix(in srgb, var(--md-success) 14%, var(--md-surface)); color: var(--md-success); }
.md-badge.md-bad { background: color-mix(in srgb, var(--md-danger) 14%, var(--md-surface)); color: var(--md-danger); }
.md-badge svg { width: 15px; height: 15px; }

.md-iconbtn {
  flex: none;
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 7px;
  background: transparent; color: var(--md-muted);
  cursor: pointer;
  transition: background .14s var(--md-ease), color .14s var(--md-ease);
}
.md-iconbtn:hover { background: var(--md-surface-2); color: var(--md-ink); }
.md-iconbtn svg { width: 16px; height: 16px; }

.md-spinner {
  width: 18px; height: 18px;
  border: 2.5px solid var(--md-border);
  border-top-color: var(--md-accent);
  border-radius: 50%;
  animation: md-spin .7s linear infinite;
}

.md-alert {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--md-danger) 35%, var(--md-border));
  background: color-mix(in srgb, var(--md-danger) 8%, var(--md-surface));
  border-radius: var(--md-radius-sm);
  font-size: 13px;
  color: var(--md-danger);
}

/* ============================ Gallery ============================ */
.md-gallery { display: flex; flex-direction: column; gap: 14px; }
.md-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--md-cell, 140px), 1fr));
  gap: 12px;
}
.md-cell {
  position: relative;
  display: block;
  border: 1px solid var(--md-border);
  border-radius: var(--md-radius-sm);
  overflow: hidden;
  background: var(--md-surface-3);
  aspect-ratio: 1 / 1;
  text-decoration: none;
  color: inherit;
  transition: border-color .14s var(--md-ease), transform .14s var(--md-ease);
}
.md-cell:hover { border-color: var(--md-border-strong); transform: translateY(-1px); }
.md-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
.md-cell-file {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; height: 100%; color: var(--md-muted); padding: 8px; text-align: center;
}
.md-cell-file svg { width: 28px; height: 28px; }
.md-cell-file span {
  font-size: 11px; max-width: 100%;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.md-cell-cap {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 6px 8px;
  font-size: 11px; color: #fff;
  background: linear-gradient(to top, rgba(16,24,40,.72), rgba(16,24,40,0));
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.md-empty {
  padding: 40px 20px;
  text-align: center;
  border: 1px dashed var(--md-border);
  border-radius: var(--md-radius);
  color: var(--md-muted);
}
.md-empty svg { width: 32px; height: 32px; margin-bottom: 10px; color: var(--md-border-strong); }
.md-empty p { margin: 0; font-size: 13px; }

.md-state { padding: 28px 20px; text-align: center; color: var(--md-ink-soft); }
.md-state .md-spinner { margin: 0 auto 12px; width: 26px; height: 26px; }

/* ---- buttons ---- */
.md-btn {
  appearance: none;
  border: 1px solid transparent;
  border-radius: var(--md-radius-sm);
  padding: 9px 16px;
  font: inherit; font-weight: 600; font-size: 13px;
  cursor: pointer;
  transition: filter .14s var(--md-ease), background .14s var(--md-ease), border-color .14s var(--md-ease);
}
.md-btn-primary { background: var(--md-accent); color: var(--md-accent-ink); }
.md-btn-primary:hover:not(:disabled) { filter: brightness(1.06); }
.md-btn-ghost { background: transparent; color: var(--md-ink-soft); border-color: var(--md-border); }
.md-btn-ghost:hover:not(:disabled) { background: var(--md-surface-2); }
.md-btn:disabled { opacity: .55; cursor: not-allowed; }
.md-actions { display: flex; gap: 10px; align-items: center; }
.md-actions-spacer { flex: 1; }

/* ---- focus-visible: 키보드만 또렷한 링 ---- */
.md-root :focus { outline: none; }
.md-root :focus-visible {
  outline: 2px solid var(--md-accent);
  outline-offset: 2px;
  border-radius: 6px;
}
.md-drop:focus-visible { outline-offset: 3px; }

@keyframes md-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .md-root *, .md-drop, .md-cell, .md-progress-bar, .md-spinner {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
  .md-spinner { animation: md-spin .9s linear infinite !important; }
}
`
