/**
 * 위젯의 스코프 CSS — 외부 프레임워크 0. 모든 규칙은 `.ad-*` 로 네임스페이스되어
 * 호스트 페이지 스타일과 충돌하지 않습니다. CSS 변수로 accent 만 주입받습니다.
 *
 * 디자인 원칙(준수):
 *  - 그라디언트 텍스트 없음 / 글래스모피즘 없음 / 사이드-스트라이프 보더 없음
 *  - 본문 대비 ≥ 4.5:1 (ink #1a1d23 on #ffffff)
 *  - :focus-visible 만 표시(마우스 클릭엔 링 없음), 키보드엔 또렷한 2px 링
 *  - prefers-reduced-motion: 모든 전환/애니메이션을 즉시화
 */
export interface WidgetTheme {
  accent: string
  accentInk: string
}

export const DEFAULT_ACCENT = '#2f5fe0' // OKLCH ~ L0.52 C0.18 H262 — 흰 텍스트와 대비 충분
export const DEFAULT_ACCENT_INK = '#ffffff'

const STYLE_ID = 'authdesk-widget-styles'

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
    '--ad-accent': theme.accent,
    '--ad-accent-ink': theme.accentInk,
  }
}

export const WIDGET_CSS = `
.ad-root, .ad-root * { box-sizing: border-box; }
.ad-root {
  --ad-accent: ${DEFAULT_ACCENT};
  --ad-accent-ink: ${DEFAULT_ACCENT_INK};
  --ad-ink: #1a1d23;
  --ad-ink-soft: #4a4f57;
  --ad-muted: #6b7280;
  --ad-surface: #ffffff;
  --ad-surface-2: #f4f5f7;
  --ad-border: #d7dae0;
  --ad-border-strong: #b7bcc6;
  --ad-danger: #b42318;
  --ad-success: #1a7f47;
  --ad-radius: 14px;
  --ad-radius-sm: 9px;
  --ad-ease: cubic-bezier(.22,1,.36,1);
  display: block;
  width: 100%;
  max-width: 380px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--ad-ink);
  line-height: 1.5;
}

.ad-card {
  border: 1px solid var(--ad-border);
  border-radius: var(--ad-radius);
  background: var(--ad-surface);
  padding: 24px;
}

.ad-title { margin: 0 0 4px; font-size: 19px; font-weight: 700; letter-spacing: -0.01em; }
.ad-subtitle { margin: 0 0 18px; font-size: 13px; color: var(--ad-muted); }

/* ---- 탭(로그인/가입 전환) ---- */
.ad-tabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  margin-bottom: 18px;
  background: var(--ad-surface-2);
  border-radius: var(--ad-radius-sm);
}
.ad-tab {
  flex: 1;
  padding: 7px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--ad-ink-soft);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background .12s var(--ad-ease), color .12s var(--ad-ease);
}
.ad-tab.ad-active { background: var(--ad-surface); color: var(--ad-ink); box-shadow: 0 1px 2px rgba(16,24,40,.08); }

/* ---- 필드 ---- */
.ad-field { display: block; margin-bottom: 14px; }
.ad-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.ad-input-wrap { position: relative; display: flex; align-items: center; }
.ad-input-icon {
  position: absolute; left: 11px;
  width: 18px; height: 18px;
  color: var(--ad-muted);
  pointer-events: none;
}
.ad-input-icon svg { width: 18px; height: 18px; }
.ad-input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  font: inherit;
  font-size: 14px;
  border: 1px solid var(--ad-border-strong);
  border-radius: var(--ad-radius-sm);
  background: var(--ad-surface);
  color: var(--ad-ink);
}
.ad-input:focus-visible { border-color: var(--ad-accent); }
.ad-input[aria-invalid="true"] { border-color: var(--ad-danger); }

/* ---- 버튼 ---- */
.ad-submit {
  width: 100%;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 11px 16px;
  border: 1px solid var(--ad-accent);
  border-radius: var(--ad-radius-sm);
  background: var(--ad-accent);
  color: var(--ad-accent-ink);
  font: inherit; font-size: 14px; font-weight: 700;
  cursor: pointer;
  transition: filter .12s var(--ad-ease), opacity .12s var(--ad-ease);
}
.ad-submit:hover { filter: brightness(1.06); }
.ad-submit:disabled { opacity: .6; cursor: not-allowed; }
.ad-submit svg { width: 18px; height: 18px; }

/* ---- 알림 ---- */
.ad-alert {
  padding: 10px 12px;
  border-radius: var(--ad-radius-sm);
  font-size: 13px;
  margin-bottom: 14px;
  display: flex; align-items: flex-start; gap: 8px;
}
.ad-alert svg { width: 17px; height: 17px; flex: none; margin-top: 1px; }
.ad-alert-error {
  background: color-mix(in srgb, var(--ad-danger) 9%, var(--ad-surface));
  color: var(--ad-danger);
  border: 1px solid color-mix(in srgb, var(--ad-danger) 28%, var(--ad-surface));
}
.ad-alert-success {
  background: color-mix(in srgb, var(--ad-success) 9%, var(--ad-surface));
  color: var(--ad-success);
  border: 1px solid color-mix(in srgb, var(--ad-success) 28%, var(--ad-surface));
}

/* ---- 인증 완료(signed-in) 상태 ---- */
.ad-signed-in { text-align: center; }
.ad-avatar {
  width: 48px; height: 48px;
  margin: 0 auto 12px;
  border-radius: 50%;
  background: var(--ad-surface-2);
  color: var(--ad-accent);
  display: grid; place-items: center;
}
.ad-avatar svg { width: 26px; height: 26px; }
.ad-signed-name { margin: 0; font-size: 16px; font-weight: 700; }
.ad-signed-email { margin: 2px 0 16px; font-size: 13px; color: var(--ad-muted); }
.ad-secondary {
  width: 100%;
  padding: 9px 16px;
  border: 1px solid var(--ad-border-strong);
  border-radius: var(--ad-radius-sm);
  background: var(--ad-surface);
  color: var(--ad-ink);
  font: inherit; font-size: 13px; font-weight: 600;
  cursor: pointer;
}
.ad-secondary:hover { background: var(--ad-surface-2); }

.ad-foot { margin: 14px 0 0; font-size: 11px; color: var(--ad-muted); text-align: center; }

/* 시각적으로 숨기되 스크린리더에는 노출 */
.ad-sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0);
  white-space: nowrap; border: 0;
}

/* focus-visible: 키보드만 또렷한 링 */
.ad-root :focus { outline: none; }
.ad-root :focus-visible { outline: 2px solid var(--ad-accent); outline-offset: 2px; border-radius: 8px; }

.ad-spin { animation: ad-spin 0.7s linear infinite; }
@keyframes ad-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .ad-root *, .ad-spin { transition-duration: .001ms !important; animation-duration: .001ms !important; }
}
`
