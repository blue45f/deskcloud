/**
 * 위젯의 스코프 CSS — 외부 프레임워크 0. 모든 규칙은 `.cd-*` 로 네임스페이스되어
 * 호스트 페이지 스타일과 충돌하지 않습니다. CSS 변수로 accent 만 주입받습니다.
 *
 * 디자인 원칙(준수):
 *  - 그라디언트 텍스트 없음 / 기본 글래스모피즘 없음 / 사이드-스트라이프 보더 없음
 *  - 본문 대비 ≥ 4.5:1 (ink #1a1d23 on #ffffff), 큰 텍스트 ≥ 3:1
 *  - :focus-visible 만 표시(마우스 클릭엔 링 없음), 키보드엔 또렷한 2px 링
 *  - prefers-reduced-motion: 모든 전환/애니메이션을 즉시화
 *  - 살균된 본문 HTML(.cd-prose)도 호스트와 충돌 없게 자체 타이포 규칙으로 감쌈
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

const STYLE_ID = 'communitydesk-widget-styles'

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
  --cd-radius: 14px;
  --cd-radius-sm: 9px;
  --cd-shadow: 0 1px 2px rgba(16,24,40,.06), 0 12px 32px -8px rgba(16,24,40,.18);
  --cd-ease: cubic-bezier(.22,1,.36,1);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--cd-ink);
  line-height: 1.5;
  font-size: 14px;
}

/* ---- 카드/컨테이너 ---- */
.cd-card {
  background: var(--cd-surface);
  border: 1px solid var(--cd-border);
  border-radius: var(--cd-radius);
  overflow: hidden;
}

/* ---- 헤더(보드 선택 + 정렬/태그) ---- */
.cd-head { padding: 16px 18px; border-bottom: 1px solid var(--cd-border); }
.cd-head-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.cd-title { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
.cd-desc { margin: 4px 0 0; font-size: 13px; color: var(--cd-ink-soft); }
.cd-head-spacer { flex: 1 1 auto; }
.cd-kind {
  font-size: 11px; font-weight: 700; letter-spacing: .02em;
  padding: 3px 8px; border-radius: 999px;
  background: var(--cd-surface-2); color: var(--cd-ink-soft);
  border: 1px solid var(--cd-border);
}

/* 보드 탭 */
.cd-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
.cd-tab {
  appearance: none; border: 1px solid var(--cd-border);
  background: var(--cd-surface); color: var(--cd-ink-soft);
  padding: 6px 12px; border-radius: 999px; font: inherit; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: background .12s var(--cd-ease), border-color .12s var(--cd-ease), color .12s var(--cd-ease);
}
.cd-tab:hover { border-color: var(--cd-border-strong); }
.cd-tab[aria-current="true"] { background: var(--cd-accent); border-color: var(--cd-accent); color: var(--cd-accent-ink); }

/* 정렬 + 태그 줄 */
.cd-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
.cd-sort { display: inline-flex; gap: 4px; background: var(--cd-surface-2); border-radius: 999px; padding: 3px; }
.cd-sort-btn {
  appearance: none; border: 0; background: transparent; color: var(--cd-ink-soft);
  padding: 5px 12px; border-radius: 999px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
  transition: background .12s var(--cd-ease), color .12s var(--cd-ease);
}
.cd-sort-btn[aria-pressed="true"] { background: var(--cd-surface); color: var(--cd-ink); box-shadow: 0 1px 2px rgba(16,24,40,.1); }
.cd-tagfilter { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--cd-muted); }
.cd-tagfilter button {
  appearance: none; border: 1px solid var(--cd-border); background: var(--cd-surface); color: var(--cd-ink-soft);
  border-radius: 999px; padding: 3px 10px; font: inherit; font-size: 12px; cursor: pointer;
}
.cd-tagfilter button:hover { border-color: var(--cd-border-strong); }

/* ---- 글 목록 ---- */
.cd-list { list-style: none; margin: 0; padding: 0; }
.cd-item { border-bottom: 1px solid var(--cd-border); }
.cd-item:last-child { border-bottom: 0; }
.cd-item-btn {
  display: block; width: 100%; text-align: left; appearance: none; border: 0; background: transparent;
  padding: 14px 18px; cursor: pointer; font: inherit; color: inherit;
  transition: background .12s var(--cd-ease);
}
.cd-item-btn:hover { background: var(--cd-surface-2); }
.cd-item-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; color: var(--cd-muted); }
.cd-pin {
  display: inline-flex; align-items: center; gap: 3px; font-weight: 700; color: var(--cd-accent);
}
.cd-pin svg { width: 13px; height: 13px; }
.cd-lock svg { width: 12px; height: 12px; vertical-align: -1px; color: var(--cd-muted); }
.cd-item-title { margin: 4px 0 0; font-size: 15px; font-weight: 600; line-height: 1.35; color: var(--cd-ink); }
.cd-excerpt { margin: 4px 0 0; font-size: 13px; color: var(--cd-ink-soft); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cd-item-foot { display: flex; align-items: center; gap: 14px; margin-top: 8px; font-size: 12px; color: var(--cd-muted); }
.cd-stat { display: inline-flex; align-items: center; gap: 4px; }
.cd-stat svg { width: 14px; height: 14px; }
.cd-tags { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 8px; }
.cd-tagchip { font-size: 11px; color: var(--cd-ink-soft); background: var(--cd-surface-2); border-radius: 6px; padding: 2px 7px; }

/* ---- 글 상세 ---- */
.cd-detail-head { display: flex; align-items: flex-start; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--cd-border); }
.cd-back {
  flex: none; appearance: none; border: 1px solid var(--cd-border); background: var(--cd-surface); color: var(--cd-ink-soft);
  width: 34px; height: 34px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  transition: background .12s var(--cd-ease), border-color .12s var(--cd-ease);
}
.cd-back:hover { background: var(--cd-surface-2); border-color: var(--cd-border-strong); }
.cd-back svg { width: 18px; height: 18px; }
.cd-detail-body { padding: 18px; }
.cd-detail-title { margin: 0 0 6px; font-size: 19px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.3; text-wrap: balance; }
.cd-byline { font-size: 12px; color: var(--cd-muted); margin-bottom: 14px; }

/* 살균 본문 타이포 — 호스트 영향 없이 자체 규칙 */
.cd-prose { font-size: 14.5px; line-height: 1.65; color: var(--cd-ink); word-break: break-word; overflow-wrap: anywhere; }
.cd-prose > :first-child { margin-top: 0; }
.cd-prose > :last-child { margin-bottom: 0; }
.cd-prose p { margin: 0 0 .85em; }
.cd-prose h1, .cd-prose h2, .cd-prose h3 { margin: 1.2em 0 .5em; line-height: 1.3; font-weight: 700; }
.cd-prose h1 { font-size: 1.4em; } .cd-prose h2 { font-size: 1.2em; } .cd-prose h3 { font-size: 1.05em; }
.cd-prose a { color: var(--cd-accent); text-underline-offset: 2px; }
.cd-prose ul, .cd-prose ol { margin: 0 0 .85em; padding-left: 1.5em; }
.cd-prose li { margin: .2em 0; }
.cd-prose blockquote { margin: 0 0 .85em; padding: .2em 0 .2em 1em; border-left: 3px solid var(--cd-border-strong); color: var(--cd-ink-soft); }
.cd-prose code { background: var(--cd-surface-3); padding: .12em .4em; border-radius: 5px; font-size: .9em; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.cd-prose pre { background: var(--cd-surface-3); padding: 12px 14px; border-radius: var(--cd-radius-sm); overflow-x: auto; margin: 0 0 .85em; }
.cd-prose pre code { background: transparent; padding: 0; }
.cd-prose hr { border: 0; border-top: 1px solid var(--cd-border); margin: 1.2em 0; }

/* ---- 반응 바 ---- */
.cd-reactions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 16px; }
.cd-react {
  appearance: none; border: 1px solid var(--cd-border); background: var(--cd-surface); color: var(--cd-ink-soft);
  border-radius: 999px; padding: 5px 11px; font: inherit; font-size: 13px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 5px;
  transition: background .12s var(--cd-ease), border-color .12s var(--cd-ease), color .12s var(--cd-ease);
}
.cd-react:hover:not(:disabled) { border-color: var(--cd-border-strong); background: var(--cd-surface-2); }
.cd-react[aria-pressed="true"] { border-color: var(--cd-accent); background: color-mix(in srgb, var(--cd-accent) 10%, var(--cd-surface)); color: var(--cd-ink); }
.cd-react:disabled { opacity: .55; cursor: not-allowed; }
.cd-react .cd-emoji { font-size: 15px; line-height: 1; }
.cd-react .cd-count { font-variant-numeric: tabular-nums; font-weight: 600; }

/* ---- 댓글 ---- */
.cd-comments { margin-top: 24px; }
.cd-comments-h { margin: 0 0 12px; font-size: 14px; font-weight: 700; }
.cd-ctree { list-style: none; margin: 0; padding: 0; }
.cd-cnode { margin-top: 12px; }
.cd-cbody { padding: 10px 12px; background: var(--cd-surface-2); border-radius: var(--cd-radius-sm); }
.cd-cmeta { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.cd-cauthor { font-weight: 600; color: var(--cd-ink); }
.cd-ctime { color: var(--cd-muted); }
.cd-ctext { margin-top: 4px; }
.cd-children { list-style: none; margin: 0; padding: 0 0 0 16px; border-left: 2px solid var(--cd-border); margin-left: 6px; }
.cd-cactions { margin-top: 6px; display: flex; gap: 12px; }
.cd-link-btn {
  appearance: none; border: 0; background: transparent; color: var(--cd-ink-soft); padding: 0;
  font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; text-underline-offset: 2px;
}
.cd-link-btn:hover { color: var(--cd-accent); text-decoration: underline; }

/* ---- compose(글/댓글 작성) ---- */
.cd-compose { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--cd-border); }
.cd-compose-inline { margin-top: 8px; }
.cd-field { margin-bottom: 10px; }
.cd-label { display: block; font-size: 12px; font-weight: 600; color: var(--cd-ink-soft); margin-bottom: 5px; }
.cd-input, .cd-textarea {
  width: 100%; border: 1px solid var(--cd-border); border-radius: var(--cd-radius-sm);
  padding: 9px 11px; font: inherit; font-size: 14px; color: var(--cd-ink); background: var(--cd-surface); resize: vertical;
  transition: border-color .12s var(--cd-ease);
}
.cd-textarea { min-height: 80px; line-height: 1.5; }
.cd-input::placeholder, .cd-textarea::placeholder { color: var(--cd-muted); }
.cd-input:hover, .cd-textarea:hover { border-color: var(--cd-border-strong); }
.cd-hint { margin: 4px 0 0; font-size: 11px; color: var(--cd-muted); }
.cd-compose-foot { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.cd-compose-foot .cd-spacer { flex: 1; }

/* ---- 버튼 ---- */
.cd-btn {
  appearance: none; border: 1px solid transparent; border-radius: var(--cd-radius-sm);
  padding: 9px 16px; font: inherit; font-weight: 600; font-size: 14px; cursor: pointer;
  transition: filter .14s var(--cd-ease), background .14s var(--cd-ease), border-color .14s var(--cd-ease);
}
.cd-btn-primary { background: var(--cd-accent); color: var(--cd-accent-ink); }
.cd-btn-primary:hover:not(:disabled) { filter: brightness(1.06); }
.cd-btn-ghost { background: transparent; color: var(--cd-ink-soft); border-color: var(--cd-border); }
.cd-btn-ghost:hover:not(:disabled) { background: var(--cd-surface-2); }
.cd-btn-sm { padding: 6px 12px; font-size: 13px; }
.cd-btn:disabled { opacity: .55; cursor: not-allowed; }

/* ---- 상태(로딩/빈/에러) ---- */
.cd-state { padding: 40px 24px; text-align: center; }
.cd-state-title { margin: 0; font-size: 15px; font-weight: 700; }
.cd-state-text { margin: 6px 0 0; font-size: 13px; color: var(--cd-ink-soft); }
.cd-spinner {
  width: 26px; height: 26px; border: 3px solid var(--cd-border); border-top-color: var(--cd-accent);
  border-radius: 50%; margin: 0 auto 14px; animation: cd-spin .7s linear infinite;
}
.cd-form-error {
  margin: 0 0 12px; padding: 9px 11px;
  border: 1px solid color-mix(in srgb, var(--cd-danger) 35%, var(--cd-border));
  background: color-mix(in srgb, var(--cd-danger) 8%, var(--cd-surface));
  border-radius: var(--cd-radius-sm); font-size: 13px; color: var(--cd-danger);
}

/* skeleton 로딩 */
.cd-skel { padding: 14px 18px; border-bottom: 1px solid var(--cd-border); }
.cd-skel-line { height: 11px; border-radius: 6px; background: var(--cd-surface-2); margin-bottom: 8px; animation: cd-pulse 1.2s var(--cd-ease) infinite; }
.cd-skel-line.cd-w70 { width: 70%; } .cd-skel-line.cd-w40 { width: 40%; } .cd-skel-line.cd-w90 { width: 90%; }

/* ---- feed(compact) ---- */
.cd-feed { display: flex; flex-direction: column; }
.cd-feed-h { display: flex; align-items: baseline; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--cd-border); }
.cd-feed-h h3 { margin: 0; font-size: 14px; font-weight: 700; }
.cd-feed-item { padding: 11px 16px; border-bottom: 1px solid var(--cd-border); }
.cd-feed-item:last-child { border-bottom: 0; }
.cd-feed-link { display: block; text-align: left; appearance: none; border: 0; background: transparent; cursor: pointer; font: inherit; color: inherit; padding: 0; width: 100%; }
.cd-feed-link:hover .cd-feed-title { color: var(--cd-accent); }
.cd-feed-title { font-size: 14px; font-weight: 600; line-height: 1.35; }
.cd-feed-meta { display: flex; gap: 8px; margin-top: 3px; font-size: 11.5px; color: var(--cd-muted); }

/* ---- focus-visible: 키보드만 또렷한 링 ---- */
.cd-root :focus { outline: none; }
.cd-root :focus-visible {
  outline: 2px solid var(--cd-accent);
  outline-offset: 2px;
  border-radius: 6px;
}
.cd-input:focus-visible, .cd-textarea:focus-visible { outline-offset: 1px; }

@keyframes cd-spin { to { transform: rotate(360deg); } }
@keyframes cd-pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }

@media (prefers-reduced-motion: reduce) {
  .cd-root *, .cd-spinner, .cd-skel-line {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
  .cd-spinner { animation: cd-spin .9s linear infinite !important; }
}
`
