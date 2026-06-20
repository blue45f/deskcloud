/**
 * 위젯의 스코프 CSS — 외부 프레임워크 0. 모든 규칙은 `.fd-*` 로 네임스페이스되어
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

const STYLE_ID = 'filedesk-widget-styles'

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
    '--fd-accent': theme.accent,
    '--fd-accent-ink': theme.accentInk,
  }
}

export const WIDGET_CSS = `
.fd-root, .fd-root * { box-sizing: border-box; }
.fd-root {
  --fd-accent: ${DEFAULT_ACCENT};
  --fd-accent-ink: ${DEFAULT_ACCENT_INK};
  --fd-ink: #1a1d23;
  --fd-ink-soft: #4a4f57;
  --fd-muted: #6b7280;
  --fd-surface: #ffffff;
  --fd-surface-2: #f4f5f7;
  --fd-drop: #eef3ff;
  --fd-border: #d7dae0;
  --fd-border-strong: #b7bcc6;
  --fd-danger: #b42318;
  --fd-success: #1a7f47;
  --fd-radius: 14px;
  --fd-radius-sm: 9px;
  --fd-ease: cubic-bezier(.22,1,.36,1);
  display: block;
  width: 100%;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--fd-ink);
  line-height: 1.5;
}

/* ---- 드롭존 ---- */
.fd-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 168px;
  padding: 28px 20px;
  border: 2px dashed var(--fd-border-strong);
  border-radius: var(--fd-radius);
  background: var(--fd-surface);
  color: var(--fd-ink-soft);
  text-align: center;
  cursor: pointer;
  transition: border-color .14s var(--fd-ease), background .14s var(--fd-ease);
}
.fd-dropzone:hover { border-color: var(--fd-accent); background: var(--fd-surface-2); }
.fd-dropzone.fd-dragging { border-color: var(--fd-accent); background: var(--fd-drop); }
.fd-dropzone.fd-disabled { opacity: .6; cursor: not-allowed; }
.fd-dz-icon {
  width: 44px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--fd-surface-2);
  color: var(--fd-accent);
}
.fd-dz-icon svg { width: 24px; height: 24px; }
.fd-dz-title { margin: 4px 0 0; font-size: 14px; font-weight: 600; color: var(--fd-ink); }
.fd-dz-hint { margin: 0; font-size: 12px; color: var(--fd-muted); }
.fd-dz-link { color: var(--fd-accent); font-weight: 600; text-decoration: underline; }

.fd-input { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }

/* ---- 업로드 목록 ---- */
.fd-list { margin: 12px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.fd-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--fd-border);
  border-radius: var(--fd-radius-sm);
  background: var(--fd-surface);
}
.fd-item-icon { flex: none; width: 22px; height: 22px; color: var(--fd-muted); }
.fd-item-icon svg { width: 22px; height: 22px; }
.fd-item-body { flex: 1; min-width: 0; }
.fd-item-name {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--fd-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fd-item-meta { margin: 2px 0 0; font-size: 11px; color: var(--fd-muted); }
.fd-item.fd-err .fd-item-meta { color: var(--fd-danger); }

/* 진행률 바 */
.fd-progress {
  margin-top: 6px;
  height: 6px;
  width: 100%;
  border-radius: 999px;
  background: var(--fd-surface-2);
  overflow: hidden;
}
.fd-progress-bar {
  height: 100%;
  background: var(--fd-accent);
  border-radius: 999px;
  transition: width .18s var(--fd-ease);
}

.fd-item-status { flex: none; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; }
.fd-item-status.fd-ok { color: var(--fd-success); }
.fd-item-status.fd-bad { color: var(--fd-danger); }
.fd-item-status svg { width: 18px; height: 18px; }

.fd-remove {
  flex: none;
  width: 26px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 6px;
  background: transparent; color: var(--fd-muted);
  cursor: pointer;
  transition: background .12s var(--fd-ease), color .12s var(--fd-ease);
}
.fd-remove:hover { background: var(--fd-surface-2); color: var(--fd-ink); }
.fd-remove svg { width: 15px; height: 15px; }

/* 시각적으로 숨기되 스크린리더에는 노출 */
.fd-sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* focus-visible: 키보드만 또렷한 링 */
.fd-root :focus { outline: none; }
.fd-root :focus-visible {
  outline: 2px solid var(--fd-accent);
  outline-offset: 2px;
  border-radius: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .fd-root *, .fd-dropzone, .fd-progress-bar {
    transition-duration: .001ms !important;
    animation-duration: .001ms !important;
  }
}
`
