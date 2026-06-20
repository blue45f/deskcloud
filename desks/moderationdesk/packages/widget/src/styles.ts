/**
 * 위젯의 스코프 CSS — 외부 프레임워크 0. 모든 규칙은 `.md-*` 로 네임스페이스되어
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
 *  - solid: 버튼/선택 배경
 *  - ink: accent 위 텍스트(대비 보장) — 미지정 시 #ffffff
 */
export interface WidgetTheme {
  accent: string
  accentInk: string
}

// 위험·신고 맥락에 어울리는 절제된 레드. 흰 텍스트와 대비 충분(≈ L0.52).
export const DEFAULT_ACCENT = '#c0362c'
export const DEFAULT_ACCENT_INK = '#ffffff'

const STYLE_ID = 'moderationdesk-widget-styles'

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
  --md-border: #d7dae0;
  --md-border-strong: #b7bcc6;
  --md-danger: #b42318;
  --md-success: #047857;
  --md-radius: 14px;
  --md-radius-sm: 9px;
  --md-shadow: 0 1px 2px rgba(16,24,40,.06), 0 12px 32px -8px rgba(16,24,40,.22);
  --md-z-backdrop: 2147483600;
  --md-z-dialog: 2147483601;
  --md-ease: cubic-bezier(.22,1,.36,1);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--md-ink);
  line-height: 1.5;
  display: contents;
}

/* ---- 신고 트리거 버튼(인라인 — 콘텐츠 옆에 붙음) ---- */
.md-report-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--md-border);
  border-radius: 999px;
  background: var(--md-surface);
  color: var(--md-ink-soft);
  font: inherit;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: background .14s var(--md-ease), border-color .14s var(--md-ease), color .14s var(--md-ease);
}
.md-report-trigger:hover { background: var(--md-surface-2); border-color: var(--md-border-strong); color: var(--md-ink); }
.md-report-trigger svg { width: 15px; height: 15px; display: block; }
.md-report-trigger.md-bare {
  border: 0;
  background: transparent;
  padding: 4px 6px;
  color: var(--md-muted);
}
.md-report-trigger.md-bare:hover { color: var(--md-accent); background: transparent; }

/* ---- backdrop + dialog (중앙 모달) ---- */
.md-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--md-z-backdrop);
  background: rgba(16,24,40,.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: md-fade .16s var(--md-ease);
}
.md-dialog {
  position: relative;
  z-index: var(--md-z-dialog);
  width: min(440px, calc(100vw - 32px));
  max-height: min(640px, calc(100vh - 40px));
  display: flex;
  flex-direction: column;
  background: var(--md-surface);
  color: var(--md-ink);
  border-radius: var(--md-radius);
  box-shadow: var(--md-shadow);
  overflow: hidden;
  animation: md-pop .2s var(--md-ease);
}

/* 화면이 좁으면 하단 시트로 — 모바일 친화 */
@media (max-width: 520px) {
  .md-backdrop { padding: 0; align-items: flex-end; justify-content: center; }
  .md-dialog {
    width: 100vw;
    max-height: 92vh;
    border-radius: 18px 18px 0 0;
    animation: md-sheet .24s var(--md-ease);
  }
}

.md-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 20px 12px;
  border-bottom: 1px solid var(--md-border);
}
.md-header-text { flex: 1; min-width: 0; }
.md-title { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -0.01em; text-wrap: balance; }
.md-subtitle { margin: 6px 0 0; font-size: 13px; color: var(--md-ink-soft); }
.md-close {
  flex: none;
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--md-muted);
  cursor: pointer;
  transition: background .14s var(--md-ease), color .14s var(--md-ease);
}
.md-close:hover { background: var(--md-surface-2); color: var(--md-ink); }
.md-close svg { width: 18px; height: 18px; }

.md-body { padding: 16px 20px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.md-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--md-border);
  display: flex;
  align-items: center;
  gap: 10px;
}
.md-footer-spacer { flex: 1; }
.md-brand { font-size: 11px; color: var(--md-muted); text-decoration: none; }
.md-brand:hover { color: var(--md-ink-soft); }

/* ---- field block ---- */
.md-field { margin: 0 0 18px; }
.md-field:last-child { margin-bottom: 4px; }
.md-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--md-ink);
}
.md-req { color: var(--md-danger); margin-left: 2px; }
.md-field-error { margin: 8px 0 0; font-size: 12px; color: var(--md-danger); }

/* ---- reason choices (radio list) ---- */
.md-reasons { display: flex; flex-direction: column; gap: 8px; }
.md-reason {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--md-border);
  border-radius: var(--md-radius-sm);
  cursor: pointer;
  font-size: 14px;
  transition: border-color .12s var(--md-ease), background .12s var(--md-ease);
}
.md-reason:hover { border-color: var(--md-border-strong); background: var(--md-surface-2); }
.md-reason.md-checked { border-color: var(--md-accent); background: color-mix(in srgb, var(--md-accent) 8%, var(--md-surface)); }
.md-reason input { accent-color: var(--md-accent); width: 17px; height: 17px; margin: 0; flex: none; }
.md-reason span { flex: 1; }

/* ---- detail textarea ---- */
.md-textarea {
  width: 100%;
  border: 1px solid var(--md-border);
  border-radius: var(--md-radius-sm);
  padding: 10px 12px;
  font: inherit;
  font-size: 14px;
  color: var(--md-ink);
  background: var(--md-surface);
  resize: vertical;
  min-height: 88px;
  line-height: 1.5;
  transition: border-color .12s var(--md-ease);
}
.md-textarea::placeholder { color: var(--md-muted); }
.md-textarea:hover { border-color: var(--md-border-strong); }
.md-count { margin-top: 4px; font-size: 11px; color: var(--md-muted); text-align: right; }

/* ---- buttons ---- */
.md-btn {
  appearance: none;
  border: 1px solid transparent;
  border-radius: var(--md-radius-sm);
  padding: 10px 18px;
  font: inherit;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: filter .14s var(--md-ease), background .14s var(--md-ease), border-color .14s var(--md-ease);
}
.md-btn-primary { background: var(--md-accent); color: var(--md-accent-ink); }
.md-btn-primary:hover:not(:disabled) { filter: brightness(1.06); }
.md-btn-ghost { background: transparent; color: var(--md-ink-soft); border-color: var(--md-border); }
.md-btn-ghost:hover:not(:disabled) { background: var(--md-surface-2); }
.md-btn:disabled { opacity: .55; cursor: not-allowed; }

/* ---- states (success / error) ---- */
.md-state { padding: 36px 24px; text-align: center; }
.md-state-icon {
  width: 52px; height: 52px;
  margin: 0 auto 14px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
}
.md-state-icon.md-ok { background: color-mix(in srgb, var(--md-success) 12%, var(--md-surface)); color: var(--md-success); }
.md-state-icon.md-err { background: color-mix(in srgb, var(--md-danger) 12%, var(--md-surface)); color: var(--md-danger); }
.md-state-icon svg { width: 28px; height: 28px; }
.md-state-title { margin: 0; font-size: 16px; font-weight: 700; }
.md-state-text { margin: 8px 0 0; font-size: 13px; color: var(--md-ink-soft); }

.md-form-error {
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--md-danger) 35%, var(--md-border));
  background: color-mix(in srgb, var(--md-danger) 8%, var(--md-surface));
  border-radius: var(--md-radius-sm);
  font-size: 13px;
  color: var(--md-danger);
}

/* ---- moderation badge (client pre-check hint) ---- */
.md-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}
.md-badge svg { width: 13px; height: 13px; }
.md-badge.md-badge-flag {
  background: color-mix(in srgb, var(--md-danger) 10%, var(--md-surface));
  color: var(--md-danger);
  border: 1px solid color-mix(in srgb, var(--md-danger) 28%, var(--md-border));
}
.md-badge.md-badge-block {
  background: var(--md-danger);
  color: #fff;
  border: 1px solid var(--md-danger);
}

/* ---- focus-visible: 키보드만 또렷한 링 ---- */
.md-root :focus { outline: none; }
.md-root :focus-visible {
  outline: 2px solid var(--md-accent);
  outline-offset: 2px;
  border-radius: 6px;
}
.md-reason:focus-within, .md-textarea:focus-visible {
  outline: 2px solid var(--md-accent);
  outline-offset: 1px;
}

@keyframes md-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes md-pop { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes md-sheet { from { transform: translateY(100%); } to { transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .md-root *, .md-backdrop, .md-dialog, .md-report-trigger {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
}
`
