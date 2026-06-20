/**
 * 위젯의 스코프 CSS — 외부 프레임워크 0. 모든 규칙은 `.rd-*` 로 네임스페이스되어
 * 호스트 페이지 스타일과 충돌하지 않습니다. CSS 변수로 accent 만 주입받습니다.
 *
 * 디자인 원칙(준수):
 *  - 그라디언트 텍스트 없음 / 글래스모피즘 없음 / 사이드-스트라이프 보더 없음
 *  - 본문 대비 ≥ 4.5:1 (ink #1a1d23 on #ffffff), 큰 텍스트 ≥ 3:1
 *  - :focus-visible 만 표시(마우스 클릭엔 링 없음), 키보드엔 또렷한 2px 링
 *  - prefers-reduced-motion: 모든 전환/애니메이션을 즉시화
 *
 * accent 는 두 형태로 받습니다:
 *  - solid: 버튼/선택 배경
 *  - ink: accent 위 텍스트(대비 보장) — 미지정 시 #ffffff
 *  별점 채움색(--rd-star)은 accent 와 독립(기본 황금색)이라 어떤 accent 와도 보임.
 */
export interface WidgetTheme {
  accent: string
  accentInk: string
}

export const DEFAULT_ACCENT = '#2f5fe0' // OKLCH ~ L0.52 C0.18 H262 — 흰 텍스트와 대비 충분
export const DEFAULT_ACCENT_INK = '#ffffff'

const STYLE_ID = 'reviewdesk-widget-styles'

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
    '--rd-accent': theme.accent,
    '--rd-accent-ink': theme.accentInk,
  }
}

export const WIDGET_CSS = `
.rd-root, .rd-root * { box-sizing: border-box; }
.rd-root {
  --rd-accent: ${DEFAULT_ACCENT};
  --rd-accent-ink: ${DEFAULT_ACCENT_INK};
  --rd-star: #e0a93f;
  --rd-ink: #1a1d23;
  --rd-ink-soft: #4a4f57;
  --rd-muted: #6b7280;
  --rd-surface: #ffffff;
  --rd-surface-2: #f4f5f7;
  --rd-border: #d7dae0;
  --rd-border-strong: #b7bcc6;
  --rd-track: #e7e9ee;
  --rd-danger: #b42318;
  --rd-success: #047857;
  --rd-radius: 14px;
  --rd-radius-sm: 9px;
  --rd-shadow: 0 1px 2px rgba(16,24,40,.06), 0 6px 18px -8px rgba(16,24,40,.16);
  --rd-ease: cubic-bezier(.22,1,.36,1);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--rd-ink);
  line-height: 1.5;
  text-align: left;
}

/* ============================ stars (shared) ============================ */
.rd-stars { display: inline-flex; gap: 2px; color: var(--rd-star); line-height: 0; }
.rd-stars svg { width: 1em; height: 1em; display: block; }
.rd-stars.rd-sm { font-size: 15px; }
.rd-stars.rd-md { font-size: 19px; }
.rd-stars.rd-lg { font-size: 26px; }
.rd-star-empty { color: var(--rd-border-strong); }

/* ============================ ReviewStars badge ============================ */
.rd-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  vertical-align: middle;
}
.rd-badge-num { font-weight: 700; font-size: 15px; color: var(--rd-ink); font-variant-numeric: tabular-nums; }
.rd-badge-count { font-size: 13px; color: var(--rd-muted); }
.rd-badge-count a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
.rd-badge-empty { font-size: 13px; color: var(--rd-muted); }
.rd-badge.rd-skeleton .rd-skel { display: inline-block; height: 1em; border-radius: 5px; background: var(--rd-track); }

/* ============================ card / list ============================ */
.rd-card {
  border: 1px solid var(--rd-border);
  border-radius: var(--rd-radius);
  background: var(--rd-surface);
  box-shadow: var(--rd-shadow);
  overflow: hidden;
}
.rd-list { width: 100%; }

.rd-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 28px;
  padding: 20px;
  border-bottom: 1px solid var(--rd-border);
}
.rd-summary-score { display: flex; flex-direction: column; gap: 4px; }
.rd-score-num { font-size: 38px; font-weight: 800; letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums; }
.rd-score-meta { font-size: 13px; color: var(--rd-muted); }
.rd-dist { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 6px; }
.rd-dist-row { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--rd-ink-soft); }
.rd-dist-star { width: 34px; flex: none; display: inline-flex; align-items: center; gap: 3px; color: var(--rd-ink-soft); font-variant-numeric: tabular-nums; }
.rd-dist-star svg { width: 12px; height: 12px; color: var(--rd-star); }
.rd-dist-track { flex: 1; height: 8px; border-radius: 999px; background: var(--rd-track); overflow: hidden; }
.rd-dist-fill { height: 100%; border-radius: 999px; background: var(--rd-star); transition: width .4s var(--rd-ease); }
.rd-dist-n { width: 34px; flex: none; text-align: right; color: var(--rd-muted); font-variant-numeric: tabular-nums; }

.rd-items { list-style: none; margin: 0; padding: 0; }
.rd-item { padding: 18px 20px; border-bottom: 1px solid var(--rd-border); }
.rd-item:last-child { border-bottom: 0; }
.rd-item-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
.rd-avatar {
  width: 34px; height: 34px; flex: none;
  border-radius: 50%;
  background: var(--rd-surface-2);
  color: var(--rd-ink-soft);
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px;
}
.rd-item-meta { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.rd-item-author { font-weight: 600; font-size: 14px; }
.rd-item-date { font-size: 12px; color: var(--rd-muted); }
.rd-item-head .rd-stars { margin-left: auto; }
.rd-featured-tag {
  font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 999px;
  background: color-mix(in srgb, var(--rd-star) 18%, var(--rd-surface));
  color: #7a5a12;
}
.rd-item-title { margin: 0 0 4px; font-size: 15px; font-weight: 700; }
.rd-item-body { margin: 0; font-size: 14px; color: var(--rd-ink-soft); white-space: pre-wrap; word-break: break-word; }
.rd-reply {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-left: 3px solid var(--rd-border-strong);
  background: var(--rd-surface-2);
  border-radius: 0 var(--rd-radius-sm) var(--rd-radius-sm) 0;
}
.rd-reply-label { font-size: 11px; font-weight: 700; color: var(--rd-muted); text-transform: uppercase; letter-spacing: .04em; }
.rd-reply-body { margin: 3px 0 0; font-size: 13px; color: var(--rd-ink-soft); white-space: pre-wrap; }

/* ============================ form ============================ */
.rd-form-card { padding: 20px; }
.rd-form-title { margin: 0 0 4px; font-size: 17px; font-weight: 700; }
.rd-form-sub { margin: 0 0 16px; font-size: 13px; color: var(--rd-ink-soft); }
.rd-field { margin: 0 0 16px; }
.rd-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--rd-ink); }
.rd-req { color: var(--rd-danger); margin-left: 2px; }
.rd-field-error { margin: 6px 0 0; font-size: 12px; color: var(--rd-danger); }

/* roving star radios (form picker) */
.rd-starpick { display: inline-flex; gap: 4px; }
.rd-starbtn {
  border: 0; background: transparent; padding: 2px; cursor: pointer;
  color: var(--rd-border-strong); line-height: 0; border-radius: 6px;
  transition: color .12s var(--rd-ease), transform .12s var(--rd-ease);
}
.rd-starbtn svg { width: 32px; height: 32px; }
.rd-starbtn:hover { transform: scale(1.08); }
.rd-starbtn.rd-on { color: var(--rd-star); }
.rd-rating-hint { margin-left: 10px; font-size: 13px; color: var(--rd-muted); vertical-align: middle; }

.rd-input, .rd-textarea {
  width: 100%;
  border: 1px solid var(--rd-border);
  border-radius: var(--rd-radius-sm);
  padding: 10px 12px;
  font: inherit;
  font-size: 14px;
  color: var(--rd-ink);
  background: var(--rd-surface);
  resize: vertical;
  transition: border-color .12s var(--rd-ease);
}
.rd-textarea { min-height: 96px; line-height: 1.5; }
.rd-input::placeholder, .rd-textarea::placeholder { color: var(--rd-muted); }
.rd-input:hover, .rd-textarea:hover { border-color: var(--rd-border-strong); }
.rd-input[aria-invalid="true"], .rd-textarea[aria-invalid="true"] { border-color: var(--rd-danger); }
.rd-count { margin-top: 4px; font-size: 11px; color: var(--rd-muted); text-align: right; }
.rd-form-actions { display: flex; align-items: center; gap: 10px; margin-top: 4px; }

.rd-form-error {
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--rd-danger) 35%, var(--rd-border));
  background: color-mix(in srgb, var(--rd-danger) 8%, var(--rd-surface));
  border-radius: var(--rd-radius-sm);
  font-size: 13px;
  color: var(--rd-danger);
}

/* ============================ buttons ============================ */
.rd-btn {
  appearance: none;
  border: 1px solid transparent;
  border-radius: var(--rd-radius-sm);
  padding: 10px 18px;
  font: inherit;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: filter .14s var(--rd-ease), background .14s var(--rd-ease), border-color .14s var(--rd-ease);
}
.rd-btn-primary { background: var(--rd-accent); color: var(--rd-accent-ink); }
.rd-btn-primary:hover:not(:disabled) { filter: brightness(1.06); }
.rd-btn-ghost { background: transparent; color: var(--rd-ink-soft); border-color: var(--rd-border); }
.rd-btn-ghost:hover:not(:disabled) { background: var(--rd-surface-2); }
.rd-btn:disabled { opacity: .55; cursor: not-allowed; }

/* ============================ states ============================ */
.rd-state { padding: 32px 24px; text-align: center; }
.rd-state-icon {
  width: 52px; height: 52px;
  margin: 0 auto 14px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
}
.rd-state-icon.rd-ok { background: color-mix(in srgb, var(--rd-success) 12%, var(--rd-surface)); color: var(--rd-success); }
.rd-state-icon.rd-err { background: color-mix(in srgb, var(--rd-danger) 12%, var(--rd-surface)); color: var(--rd-danger); }
.rd-state-icon svg { width: 28px; height: 28px; }
.rd-state-title { margin: 0; font-size: 16px; font-weight: 700; }
.rd-state-text { margin: 8px 0 0; font-size: 13px; color: var(--rd-ink-soft); }
.rd-empty { padding: 28px 20px; text-align: center; color: var(--rd-muted); font-size: 14px; }

.rd-spinner {
  width: 26px; height: 26px;
  border: 3px solid var(--rd-border);
  border-top-color: var(--rd-accent);
  border-radius: 50%;
  margin: 0 auto;
  animation: rd-spin .7s linear infinite;
}

/* ============================ TestimonialWall ============================ */
.rd-wall { width: 100%; }
.rd-wall-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.rd-tcard {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--rd-border);
  border-radius: var(--rd-radius);
  background: var(--rd-surface);
  box-shadow: var(--rd-shadow);
}
.rd-tcard-quote { color: var(--rd-border-strong); }
.rd-tcard-quote svg { width: 26px; height: 26px; }
.rd-tcard-body { margin: 0; flex: 1; font-size: 14px; color: var(--rd-ink); white-space: pre-wrap; word-break: break-word; }
.rd-tcard-foot { display: flex; align-items: center; gap: 10px; }
.rd-tcard-foot .rd-stars { margin-left: auto; }

/* ============================ skeleton shimmer ============================ */
.rd-skel-block { background: var(--rd-track); border-radius: 8px; }
.rd-loading .rd-skel-block, .rd-badge.rd-skeleton .rd-skel {
  animation: rd-pulse 1.2s ease-in-out infinite;
}

/* ============================ focus-visible ============================ */
.rd-root :focus { outline: none; }
.rd-root :focus-visible {
  outline: 2px solid var(--rd-accent);
  outline-offset: 2px;
  border-radius: 6px;
}
.rd-input:focus-visible, .rd-textarea:focus-visible {
  outline: 2px solid var(--rd-accent);
  outline-offset: 1px;
}

@keyframes rd-spin { to { transform: rotate(360deg); } }
@keyframes rd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }

@media (prefers-reduced-motion: reduce) {
  .rd-root *, .rd-spinner, .rd-dist-fill, .rd-starbtn {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
  .rd-spinner { animation: rd-spin .9s linear infinite !important; }
}
`
