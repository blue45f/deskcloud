/**
 * ChatDesk 위젯의 스코프 CSS — 외부 프레임워크 0. 모든 규칙은 `.cd-*` 로 네임스페이스되어
 * 호스트 페이지 스타일과 충돌하지 않습니다. CSS 변수로 accent 만 주입받습니다.
 *
 * 디자인 원칙(준수):
 *  - 그라디언트 텍스트 없음 / 기본 글래스모피즘 없음 / 사이드-스트라이프 보더 없음
 *  - 본문 대비 ≥ 4.5:1 (ink #1a1d23 on #ffffff), 큰 텍스트 ≥ 3:1
 *  - :focus-visible 만 표시(마우스 클릭엔 링 없음), 키보드엔 또렷한 2px 링
 *  - prefers-reduced-motion: 모든 전환/애니메이션을 즉시화
 *  - 시맨틱 z-index 스케일(launcher < panel)
 *
 * accent 는 두 형태로 받습니다:
 *  - solid: 버튼/내 말풍선/선택 배경
 *  - ink: accent 위 텍스트(대비 보장) — 미지정 시 #ffffff
 */
export interface WidgetTheme {
  accent: string
  accentInk: string
}

export const DEFAULT_ACCENT = '#2f5fe0' // OKLCH ~ L0.52 C0.18 H262 — 흰 텍스트와 대비 충분
export const DEFAULT_ACCENT_INK = '#ffffff'

const STYLE_ID = 'chatdesk-widget-styles'

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
  --cd-surface-3: #eceef1;
  --cd-border: #d7dae0;
  --cd-border-strong: #b7bcc6;
  --cd-danger: #b42318;
  --cd-success: #047857;
  --cd-radius: 16px;
  --cd-radius-sm: 10px;
  --cd-bubble-radius: 16px;
  --cd-shadow: 0 1px 2px rgba(16,24,40,.06), 0 12px 32px -8px rgba(16,24,40,.22);
  --cd-z-launcher: 2147483000;
  --cd-z-panel: 2147483600;
  --cd-ease: cubic-bezier(.22,1,.36,1);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--cd-ink);
  line-height: 1.5;
}

/* ---- launcher 버튼 ---- */
.cd-launcher {
  position: fixed;
  z-index: var(--cd-z-launcher);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border: 0;
  border-radius: 999px;
  background: var(--cd-accent);
  color: var(--cd-accent-ink);
  font: inherit;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  box-shadow: var(--cd-shadow);
  transition: transform .18s var(--cd-ease), filter .18s var(--cd-ease);
}
.cd-launcher:hover { filter: brightness(1.06); transform: translateY(-1px); }
.cd-launcher:active { transform: translateY(0); }
.cd-launcher svg { width: 18px; height: 18px; display: block; }
.cd-launcher-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--cd-accent-ink);
  color: var(--cd-accent);
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}
.cd-pos-br { right: 20px; bottom: 20px; }
.cd-pos-bl { left: 20px; bottom: 20px; }
.cd-pos-tr { right: 20px; top: 20px; }
.cd-pos-tl { left: 20px; top: 20px; }

/* ---- panel ---- */
.cd-panel {
  position: fixed;
  z-index: var(--cd-z-panel);
  width: min(384px, calc(100vw - 32px));
  height: min(620px, calc(100vh - 40px));
  display: flex;
  flex-direction: column;
  background: var(--cd-surface);
  color: var(--cd-ink);
  border: 1px solid var(--cd-border);
  border-radius: var(--cd-radius);
  box-shadow: var(--cd-shadow);
  overflow: hidden;
  animation: cd-pop .2s var(--cd-ease);
}
.cd-panel.cd-pos-br { right: 20px; bottom: 20px; }
.cd-panel.cd-pos-bl { left: 20px; bottom: 20px; }
.cd-panel.cd-pos-tr { right: 20px; top: 20px; }
.cd-panel.cd-pos-tl { left: 20px; top: 20px; }

@media (max-width: 480px) {
  .cd-panel {
    width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    inset: 0 !important;
    border-radius: 0;
    border: 0;
    animation: cd-sheet .24s var(--cd-ease);
  }
}

/* ---- header ---- */
.cd-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px 14px 16px;
  border-bottom: 1px solid var(--cd-border);
  background: var(--cd-surface);
}
.cd-header-title { flex: 1; min-width: 0; }
.cd-header-title h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cd-header-sub { margin: 2px 0 0; font-size: 12px; color: var(--cd-muted); }
.cd-header-sub.cd-online { color: var(--cd-success); }
.cd-iconbtn {
  flex: none;
  width: 34px; height: 34px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--cd-muted);
  cursor: pointer;
  transition: background .14s var(--cd-ease), color .14s var(--cd-ease);
}
.cd-iconbtn:hover { background: var(--cd-surface-2); color: var(--cd-ink); }
.cd-iconbtn svg { width: 20px; height: 20px; }

/* ---- conversation list ---- */
.cd-list { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 6px; }
.cd-conv {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 11px 12px;
  border: 0;
  border-radius: var(--cd-radius-sm);
  background: transparent;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: background .12s var(--cd-ease);
}
.cd-conv:hover { background: var(--cd-surface-2); }
.cd-avatar {
  flex: none;
  width: 40px; height: 40px;
  border-radius: 50%;
  background: var(--cd-surface-3);
  color: var(--cd-ink-soft);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.cd-avatar svg { width: 22px; height: 22px; }
.cd-conv-body { flex: 1; min-width: 0; }
.cd-conv-top { display: flex; align-items: baseline; gap: 8px; }
.cd-conv-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cd-conv-time { flex: none; font-size: 11px; color: var(--cd-muted); }
.cd-conv-preview {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--cd-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cd-conv-preview.cd-unread { color: var(--cd-ink); font-weight: 600; }
.cd-badge {
  flex: none;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--cd-accent);
  color: var(--cd-accent-ink);
  font-size: 11px;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
}

/* ---- message thread ---- */
.cd-thread {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 16px 14px 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  background: var(--cd-surface-2);
}
.cd-loadmore {
  align-self: center;
  margin-bottom: 8px;
  padding: 6px 14px;
  border: 1px solid var(--cd-border);
  border-radius: 999px;
  background: var(--cd-surface);
  color: var(--cd-ink-soft);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.cd-loadmore:hover { border-color: var(--cd-border-strong); }
.cd-day {
  align-self: center;
  margin: 10px 0;
  padding: 3px 12px;
  border-radius: 999px;
  background: var(--cd-surface-3);
  color: var(--cd-ink-soft);
  font-size: 11px;
  font-weight: 600;
}
.cd-msg-row { display: flex; flex-direction: column; max-width: 80%; }
.cd-msg-row.cd-mine { align-self: flex-end; align-items: flex-end; }
.cd-msg-row.cd-theirs { align-self: flex-start; align-items: flex-start; }
.cd-msg-row.cd-system { align-self: center; max-width: 92%; align-items: center; }
.cd-msg-sender {
  margin: 8px 4px 2px;
  font-size: 11px;
  font-weight: 600;
  color: var(--cd-muted);
}
.cd-bubble {
  padding: 9px 13px;
  border-radius: var(--cd-bubble-radius);
  font-size: 14px;
  line-height: 1.45;
  word-break: break-word;
  white-space: pre-wrap;
  box-shadow: 0 1px 1px rgba(16,24,40,.04);
}
.cd-mine .cd-bubble {
  background: var(--cd-accent);
  color: var(--cd-accent-ink);
  border-bottom-right-radius: 5px;
}
.cd-theirs .cd-bubble {
  background: var(--cd-surface);
  color: var(--cd-ink);
  border: 1px solid var(--cd-border);
  border-bottom-left-radius: 5px;
}
.cd-system .cd-bubble {
  background: transparent;
  color: var(--cd-muted);
  border: 0;
  font-size: 12.5px;
  text-align: center;
  box-shadow: none;
  padding: 4px 10px;
}
.cd-bubble.cd-deleted { font-style: italic; opacity: .7; }
.cd-msg-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 2px 4px 0;
  font-size: 10.5px;
  color: var(--cd-muted);
}
.cd-msg-meta .cd-receipt { width: 14px; height: 14px; color: var(--cd-muted); }
.cd-msg-meta .cd-receipt.cd-read { color: var(--cd-accent); }
.cd-attach {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 12.5px;
  text-decoration: underline;
}
.cd-mine .cd-attach { color: var(--cd-accent-ink); }
.cd-theirs .cd-attach { color: var(--cd-accent); }

/* ---- typing indicator ---- */
.cd-typing {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 4px 4px 2px;
  padding: 9px 14px;
  border-radius: var(--cd-bubble-radius);
  border-bottom-left-radius: 5px;
  background: var(--cd-surface);
  border: 1px solid var(--cd-border);
}
.cd-typing span {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--cd-muted);
  animation: cd-bounce 1.2s var(--cd-ease) infinite;
}
.cd-typing span:nth-child(2) { animation-delay: .15s; }
.cd-typing span:nth-child(3) { animation-delay: .3s; }
.cd-typing-text {
  align-self: flex-start;
  margin: 0 6px 4px;
  font-size: 11px;
  color: var(--cd-muted);
}

/* ---- composer ---- */
.cd-composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--cd-border);
  background: var(--cd-surface);
}
.cd-composer textarea {
  flex: 1;
  min-height: 40px;
  max-height: 120px;
  resize: none;
  padding: 9px 12px;
  border: 1px solid var(--cd-border);
  border-radius: 20px;
  font: inherit;
  font-size: 14px;
  line-height: 1.4;
  color: var(--cd-ink);
  background: var(--cd-surface);
  transition: border-color .12s var(--cd-ease);
}
.cd-composer textarea::placeholder { color: var(--cd-muted); }
.cd-composer textarea:hover { border-color: var(--cd-border-strong); }
.cd-send {
  flex: none;
  width: 40px; height: 40px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 0;
  border-radius: 50%;
  background: var(--cd-accent);
  color: var(--cd-accent-ink);
  cursor: pointer;
  transition: filter .14s var(--cd-ease);
}
.cd-send:hover:not(:disabled) { filter: brightness(1.06); }
.cd-send:disabled { opacity: .5; cursor: not-allowed; }
.cd-send svg { width: 20px; height: 20px; }

/* ---- states (loading / empty / error) ---- */
.cd-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 28px;
  text-align: center;
}
.cd-state-icon {
  width: 52px; height: 52px;
  margin-bottom: 14px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--cd-surface-2);
  color: var(--cd-muted);
}
.cd-state-icon.cd-err { background: color-mix(in srgb, var(--cd-danger) 12%, var(--cd-surface)); color: var(--cd-danger); }
.cd-state-icon svg { width: 28px; height: 28px; }
.cd-state-title { margin: 0; font-size: 15px; font-weight: 700; }
.cd-state-text { margin: 8px 0 0; font-size: 13px; color: var(--cd-ink-soft); max-width: 28ch; }
.cd-spinner {
  width: 28px; height: 28px;
  border: 3px solid var(--cd-border);
  border-top-color: var(--cd-accent);
  border-radius: 50%;
  animation: cd-spin .7s linear infinite;
}
.cd-btn {
  margin-top: 16px;
  appearance: none;
  border: 1px solid transparent;
  border-radius: var(--cd-radius-sm);
  padding: 9px 18px;
  font: inherit;
  font-weight: 600;
  font-size: 14px;
  background: var(--cd-accent);
  color: var(--cd-accent-ink);
  cursor: pointer;
  transition: filter .14s var(--cd-ease);
}
.cd-btn:hover { filter: brightness(1.06); }

/* sr-only — aria-live 영역 시각 숨김(스크린리더 전용). */
.cd-sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* ---- focus-visible: 키보드만 또렷한 링 ---- */
.cd-root :focus { outline: none; }
.cd-root :focus-visible {
  outline: 2px solid var(--cd-accent);
  outline-offset: 2px;
  border-radius: 8px;
}
.cd-composer textarea:focus-visible { outline-offset: 1px; }

@keyframes cd-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes cd-pop { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes cd-sheet { from { transform: translateY(100%); } to { transform: none; } }
@keyframes cd-spin { to { transform: rotate(360deg); } }
@keyframes cd-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-4px); opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  .cd-root *, .cd-panel, .cd-launcher, .cd-spinner, .cd-typing span {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
  .cd-spinner { animation: cd-spin .9s linear infinite !important; }
}
`
