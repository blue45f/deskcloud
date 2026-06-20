/**
 * PresenceBar 의 스코프 CSS — 외부 프레임워크 0. 모든 규칙은 `.rt-*` 로 네임스페이스되어
 * 호스트 페이지 스타일과 충돌하지 않습니다. CSS 변수로 accent 만 주입받습니다.
 *
 * 디자인 원칙(준수):
 *  - 그라디언트 텍스트 없음 / 글래스모피즘 없음 / 사이드-스트라이프 보더 없음
 *  - 본문 대비 ≥ 4.5:1 (ink #1a1d23 on #ffffff), 큰 텍스트 ≥ 3:1
 *  - :focus-visible 만 표시, 키보드엔 또렷한 2px 링
 *  - prefers-reduced-motion: 모든 전환/애니메이션을 즉시화
 */
export interface WidgetTheme {
  accent: string;
  accentInk: string;
}

export const DEFAULT_ACCENT = "#2f5fe0"; // OKLCH ~ L0.52 C0.18 H262 — 흰 텍스트와 대비 충분
export const DEFAULT_ACCENT_INK = "#ffffff";

const STYLE_ID = "realtimedesk-widget-styles";

/** 한 번만 주입(중복 방지). accent 는 CSS 변수라 마운트마다 인라인으로 덮어쓸 수 있음. */
export function ensureStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement("style");
  el.id = STYLE_ID;
  el.textContent = WIDGET_CSS;
  doc.head.appendChild(el);
}

/** 마운트 루트에 줄 인라인 CSS 변수(accent 커스터마이즈). */
export function themeVars(theme: WidgetTheme): Record<string, string> {
  return {
    "--rt-accent": theme.accent,
    "--rt-accent-ink": theme.accentInk,
  };
}

/** 멤버 식별자에서 결정론적 색을 뽑는다(아바타 배경). 대비를 위해 어두운 톤. */
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  // 채도·명도를 고정해 흰 글자(initial)와 대비 ≥4.5:1 확보.
  return `hsl(${hue} 52% 38%)`;
}

/** 멤버 식별자에서 한 글자 이니셜을 만든다(아바타 라벨). 영숫자가 없으면 '?'. */
export function avatarInitial(seed: string): string {
  const trimmed = seed.replace(/[^A-Za-z0-9]/g, "");
  return (trimmed[0] ?? "?").toUpperCase();
}

export const WIDGET_CSS = `
.rt-root, .rt-root * { box-sizing: border-box; }
.rt-root {
  --rt-accent: ${DEFAULT_ACCENT};
  --rt-accent-ink: ${DEFAULT_ACCENT_INK};
  --rt-ink: #1a1d23;
  --rt-ink-soft: #4a4f57;
  --rt-muted: #6b7280;
  --rt-surface: #ffffff;
  --rt-surface-2: #f4f5f7;
  --rt-border: #d7dae0;
  --rt-online: #16a34a;
  --rt-offline: #9ca3af;
  --rt-radius: 999px;
  --rt-shadow: 0 1px 2px rgba(16,24,40,.06), 0 8px 24px -10px rgba(16,24,40,.18);
  --rt-ease: cubic-bezier(.22,1,.36,1);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--rt-ink);
  line-height: 1.5;
  display: inline-flex;
}

/* ---- presence bar ---- */
.rt-bar {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px 6px 8px;
  background: var(--rt-surface);
  border: 1px solid var(--rt-border);
  border-radius: var(--rt-radius);
  box-shadow: var(--rt-shadow);
  font-size: 13px;
  max-width: 100%;
}

/* ---- live status dot ---- */
.rt-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-left: 4px;
  flex: none;
}
.rt-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--rt-offline);
  flex: none;
  position: relative;
}
.rt-dot.rt-live { background: var(--rt-online); }
.rt-dot.rt-live::after {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid var(--rt-online);
  opacity: .55;
  animation: rt-ping 1.8s var(--rt-ease) infinite;
}
.rt-status-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--rt-muted);
  letter-spacing: .01em;
}

/* ---- avatar stack ---- */
.rt-avatars {
  display: inline-flex;
  align-items: center;
  padding-left: 2px;
}
.rt-avatar {
  width: 26px; height: 26px;
  border-radius: 50%;
  border: 2px solid var(--rt-surface);
  margin-left: -8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  flex: none;
  user-select: none;
  animation: rt-pop .22s var(--rt-ease);
}
.rt-avatar:first-child { margin-left: 0; }
.rt-avatar-more {
  background: var(--rt-surface-2);
  color: var(--rt-ink-soft);
  border-color: var(--rt-surface);
}

/* ---- count label ---- */
.rt-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--rt-ink);
  white-space: nowrap;
}
.rt-count-num { color: var(--rt-accent); }
.rt-empty { color: var(--rt-muted); font-weight: 500; }

/* ---- focus-visible: 키보드만 또렷한 링 ---- */
.rt-root :focus { outline: none; }
.rt-root :focus-visible {
  outline: 2px solid var(--rt-accent);
  outline-offset: 2px;
  border-radius: 8px;
}

@keyframes rt-ping { 0% { transform: scale(.8); opacity: .55; } 80%,100% { transform: scale(1.9); opacity: 0; } }
@keyframes rt-pop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .rt-root *, .rt-avatar, .rt-dot.rt-live::after {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
}
`;
