/**
 * 위젯의 스코프 CSS — 외부 프레임워크 0. 모든 규칙은 `.sd-*` 로 네임스페이스되어
 * 호스트 페이지 스타일과 충돌하지 않습니다. CSS 변수로 accent 만 주입받습니다.
 *
 * 디자인 원칙(준수):
 *  - 그라디언트 텍스트 없음 / 기본 글래스모피즘 없음 / 사이드-스트라이프 보더 없음
 *  - 본문 대비 ≥ 4.5:1 (ink #1a1d23 on #ffffff), 큰 텍스트 ≥ 3:1
 *  - :focus-visible 만 표시(마우스 클릭엔 링 없음), 키보드엔 또렷한 2px 링
 *  - prefers-reduced-motion: 모든 전환/애니메이션을 즉시화
 *  - 시맨틱 z-index 스케일(launcher < backdrop < dialog)
 *
 * accent 는 두 형태로 받습니다:
 *  - solid: 버튼/선택 배경
 *  - ink: accent 위 텍스트(대비 보장) — 미지정 시 #ffffff
 */
export interface WidgetTheme {
  accent: string
  accentInk: string
}

export const DEFAULT_ACCENT = '#2f5fe0' // OKLCH ~ L0.52 C0.18 H262 — 흰 텍스트와 대비 충분
export const DEFAULT_ACCENT_INK = '#ffffff'

const STYLE_ID = 'surveydesk-widget-styles'

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
    '--sd-accent': theme.accent,
    '--sd-accent-ink': theme.accentInk,
  }
}

export const WIDGET_CSS = `
.sd-root, .sd-root * { box-sizing: border-box; }
.sd-root {
  --sd-accent: ${DEFAULT_ACCENT};
  --sd-accent-ink: ${DEFAULT_ACCENT_INK};
  --sd-ink: #1a1d23;
  --sd-ink-soft: #4a4f57;
  --sd-muted: #6b7280;
  --sd-surface: #ffffff;
  --sd-surface-2: #f4f5f7;
  --sd-border: #d7dae0;
  --sd-border-strong: #b7bcc6;
  --sd-danger: #b42318;
  --sd-success: #047857;
  --sd-radius: 14px;
  --sd-radius-sm: 9px;
  --sd-shadow: 0 1px 2px rgba(16,24,40,.06), 0 12px 32px -8px rgba(16,24,40,.22);
  --sd-z-launcher: 2147483000;
  --sd-z-backdrop: 2147483600;
  --sd-z-dialog: 2147483601;
  --sd-ease: cubic-bezier(.22,1,.36,1);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--sd-ink);
  line-height: 1.5;
}

/* ---- launcher 버튼 ---- */
.sd-launcher {
  position: fixed;
  z-index: var(--sd-z-launcher);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border: 0;
  border-radius: 999px;
  background: var(--sd-accent);
  color: var(--sd-accent-ink);
  font: inherit;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  box-shadow: var(--sd-shadow);
  transition: transform .18s var(--sd-ease), filter .18s var(--sd-ease);
}
.sd-launcher:hover { filter: brightness(1.06); transform: translateY(-1px); }
.sd-launcher:active { transform: translateY(0); }
.sd-launcher svg { width: 18px; height: 18px; display: block; }
.sd-pos-br { right: 20px; bottom: 20px; }
.sd-pos-bl { left: 20px; bottom: 20px; }
.sd-pos-tr { right: 20px; top: 20px; }
.sd-pos-tl { left: 20px; top: 20px; }

/* ---- backdrop + dialog ---- */
.sd-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--sd-z-backdrop);
  background: rgba(16,24,40,.42);
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 20px;
  animation: sd-fade .16s var(--sd-ease);
}
.sd-dialog {
  position: relative;
  z-index: var(--sd-z-dialog);
  width: min(420px, calc(100vw - 32px));
  max-height: min(640px, calc(100vh - 40px));
  display: flex;
  flex-direction: column;
  background: var(--sd-surface);
  color: var(--sd-ink);
  border-radius: var(--sd-radius);
  box-shadow: var(--sd-shadow);
  overflow: hidden;
  animation: sd-pop .2s var(--sd-ease);
}

/* 화면이 좁으면 하단 시트로 — 모바일 친화 */
@media (max-width: 520px) {
  .sd-backdrop { padding: 0; align-items: flex-end; justify-content: center; }
  .sd-dialog {
    width: 100vw;
    max-height: 92vh;
    border-radius: 18px 18px 0 0;
    animation: sd-sheet .24s var(--sd-ease);
  }
}

.sd-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 20px 12px;
  border-bottom: 1px solid var(--sd-border);
}
.sd-header-text { flex: 1; min-width: 0; }
.sd-title { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -0.01em; text-wrap: balance; }
.sd-intro { margin: 6px 0 0; font-size: 13px; color: var(--sd-ink-soft); }
.sd-close {
  flex: none;
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--sd-muted);
  cursor: pointer;
  transition: background .14s var(--sd-ease), color .14s var(--sd-ease);
}
.sd-close:hover { background: var(--sd-surface-2); color: var(--sd-ink); }
.sd-close svg { width: 18px; height: 18px; }

.sd-body { padding: 16px 20px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.sd-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--sd-border);
  display: flex;
  align-items: center;
  gap: 10px;
}
.sd-footer-spacer { flex: 1; }
.sd-brand { font-size: 11px; color: var(--sd-muted); text-decoration: none; }
.sd-brand:hover { color: var(--sd-ink-soft); }

/* ---- question block ---- */
.sd-q { margin: 0 0 22px; }
.sd-q:last-child { margin-bottom: 4px; }
.sd-q-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--sd-ink);
}
.sd-req { color: var(--sd-danger); margin-left: 2px; }
.sd-q-error { margin: 8px 0 0; font-size: 12px; color: var(--sd-danger); }

/* ---- star rating ---- */
.sd-stars { display: inline-flex; gap: 4px; }
.sd-star {
  border: 0;
  background: transparent;
  padding: 2px;
  cursor: pointer;
  color: var(--sd-border-strong);
  line-height: 0;
  border-radius: 6px;
  transition: color .12s var(--sd-ease), transform .12s var(--sd-ease);
}
.sd-star svg { width: 30px; height: 30px; }
.sd-star:hover { transform: scale(1.08); }
.sd-star[aria-checked="true"], .sd-star.sd-on { color: var(--sd-accent); }

/* ---- NPS scale ---- */
.sd-nps { display: grid; grid-template-columns: repeat(11, 1fr); gap: 5px; }
.sd-nps-btn {
  border: 1px solid var(--sd-border);
  background: var(--sd-surface);
  color: var(--sd-ink-soft);
  border-radius: 8px;
  padding: 8px 0;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background .12s var(--sd-ease), border-color .12s var(--sd-ease), color .12s var(--sd-ease);
}
.sd-nps-btn:hover { border-color: var(--sd-border-strong); }
.sd-nps-btn[aria-pressed="true"] {
  background: var(--sd-accent);
  border-color: var(--sd-accent);
  color: var(--sd-accent-ink);
}
.sd-nps-legend {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  color: var(--sd-muted);
}

/* ---- choice (single/multi) ---- */
.sd-choices { display: flex; flex-direction: column; gap: 8px; }
.sd-choice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--sd-border);
  border-radius: var(--sd-radius-sm);
  cursor: pointer;
  font-size: 14px;
  transition: border-color .12s var(--sd-ease), background .12s var(--sd-ease);
}
.sd-choice:hover { border-color: var(--sd-border-strong); background: var(--sd-surface-2); }
.sd-choice.sd-checked { border-color: var(--sd-accent); background: color-mix(in srgb, var(--sd-accent) 8%, var(--sd-surface)); }
.sd-choice input { accent-color: var(--sd-accent); width: 17px; height: 17px; margin: 0; flex: none; }
.sd-choice span { flex: 1; }

/* ---- text input ---- */
.sd-input, .sd-textarea {
  width: 100%;
  border: 1px solid var(--sd-border);
  border-radius: var(--sd-radius-sm);
  padding: 10px 12px;
  font: inherit;
  font-size: 14px;
  color: var(--sd-ink);
  background: var(--sd-surface);
  resize: vertical;
  transition: border-color .12s var(--sd-ease), box-shadow .12s var(--sd-ease);
}
.sd-textarea { min-height: 88px; line-height: 1.5; }
.sd-input::placeholder, .sd-textarea::placeholder { color: var(--sd-muted); }
.sd-input:hover, .sd-textarea:hover { border-color: var(--sd-border-strong); }
.sd-count { margin-top: 4px; font-size: 11px; color: var(--sd-muted); text-align: right; }

/* ---- primary / secondary buttons ---- */
.sd-btn {
  appearance: none;
  border: 1px solid transparent;
  border-radius: var(--sd-radius-sm);
  padding: 10px 18px;
  font: inherit;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: filter .14s var(--sd-ease), background .14s var(--sd-ease), border-color .14s var(--sd-ease);
}
.sd-btn-primary { background: var(--sd-accent); color: var(--sd-accent-ink); }
.sd-btn-primary:hover:not(:disabled) { filter: brightness(1.06); }
.sd-btn-ghost { background: transparent; color: var(--sd-ink-soft); border-color: var(--sd-border); }
.sd-btn-ghost:hover:not(:disabled) { background: var(--sd-surface-2); }
.sd-btn:disabled { opacity: .55; cursor: not-allowed; }

/* ---- states (loading / success / error) ---- */
.sd-state { padding: 36px 24px; text-align: center; }
.sd-state-icon {
  width: 52px; height: 52px;
  margin: 0 auto 14px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
}
.sd-state-icon.sd-ok { background: color-mix(in srgb, var(--sd-success) 12%, var(--sd-surface)); color: var(--sd-success); }
.sd-state-icon.sd-err { background: color-mix(in srgb, var(--sd-danger) 12%, var(--sd-surface)); color: var(--sd-danger); }
.sd-state-icon svg { width: 28px; height: 28px; }
.sd-state-title { margin: 0; font-size: 16px; font-weight: 700; }
.sd-state-text { margin: 8px 0 0; font-size: 13px; color: var(--sd-ink-soft); }

.sd-spinner {
  width: 28px; height: 28px;
  border: 3px solid var(--sd-border);
  border-top-color: var(--sd-accent);
  border-radius: 50%;
  margin: 0 auto;
  animation: sd-spin .7s linear infinite;
}

.sd-form-error {
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--sd-danger) 35%, var(--sd-border));
  background: color-mix(in srgb, var(--sd-danger) 8%, var(--sd-surface));
  border-radius: var(--sd-radius-sm);
  font-size: 13px;
  color: var(--sd-danger);
}

/* ---- focus-visible: 키보드만 또렷한 링 ---- */
.sd-root :focus { outline: none; }
.sd-root :focus-visible {
  outline: 2px solid var(--sd-accent);
  outline-offset: 2px;
  border-radius: 6px;
}
.sd-nps-btn:focus-visible, .sd-choice:focus-within, .sd-input:focus-visible, .sd-textarea:focus-visible {
  outline: 2px solid var(--sd-accent);
  outline-offset: 1px;
}

@keyframes sd-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes sd-pop { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes sd-sheet { from { transform: translateY(100%); } to { transform: none; } }
@keyframes sd-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .sd-root *, .sd-backdrop, .sd-dialog, .sd-launcher, .sd-star, .sd-spinner {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
  .sd-spinner { animation: sd-spin .9s linear infinite !important; }
}
`
