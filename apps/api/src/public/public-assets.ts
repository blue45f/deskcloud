import type { PublicRenderDto } from '@termsdesk/shared'

/** HTML 특수문자 이스케이프 — 본문은 조직 작성이지만 `<`,`&` 등을 항상 안전하게 출력. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const HEADING_RE = /^(제\s*\d+\s*조|#{1,6}\s+)/
const BULLET_RE = /^[-*]\s+/

/** 줄 단위 본문 → 의미 있는 문단/소제목/목록 HTML. `제N조`·`#` 줄은 소제목, `- `·`* ` 연속 줄은 목록. */
function renderBodyHtml(body: string): string {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let list: string[] | null = null
  const flushList = () => {
    if (list && list.length > 0) {
      out.push(`<ul class="tdk-ul">\n${list.join('\n')}\n</ul>`)
    }
    list = null
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.trim() === '') {
      flushList()
      out.push('<div class="tdk-gap" aria-hidden="true"></div>')
      continue
    }
    if (BULLET_RE.test(line.trim())) {
      const text = line.trim().replace(BULLET_RE, '')
      ;(list ??= []).push(`<li class="tdk-li">${escapeHtml(text)}</li>`)
      continue
    }
    flushList()
    if (HEADING_RE.test(line.trim())) {
      const text = line.trim().replace(/^#{1,6}\s+/, '')
      out.push(`<h2 class="tdk-h">${escapeHtml(text)}</h2>`)
    } else {
      out.push(`<p class="tdk-p">${escapeHtml(line)}</p>`)
    }
  }
  flushList()
  return out.join('\n')
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')}`
}

export type RenderTheme = 'light' | 'dark' | 'auto'
export type RenderFont = 'sans' | 'serif'
export type RenderAlign = 'left' | 'center'
export type RenderWidth = 'narrow' | 'normal' | 'wide'

/** 표시 스타일 옵션 — 게시 원문/해시와 무관한 순수 표현 레이어. */
export interface RenderStyleOpts {
  theme?: RenderTheme
  /** 강조색(인장색). `#` 유무 무관, 3~8자리 hex. 유효하지 않으면 무시. */
  accent?: string
  font?: RenderFont
  align?: RenderAlign
  width?: RenderWidth
}

const SANS_STACK = `"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", Roboto, "Noto Sans KR", sans-serif`
const SERIF_STACK = `"Noto Serif KR", "Apple Myungjo", Batang, 바탕, Georgia, "Times New Roman", serif`
const WIDTHS: Record<RenderWidth, string> = { narrow: '38rem', normal: '46rem', wide: '54rem' }

/** `#abc`/`a1b2c3` 등만 통과시켜 CSS 주입을 방지. */
export function sanitizeHexColor(input: string | undefined): string | null {
  if (!input) return null
  const hex = input.trim().replace(/^#/, '')
  return /^[0-9a-fA-F]{3,8}$/.test(hex) ? `#${hex}` : null
}

/** opts → :root 오버라이드 CSS(없으면 빈 문자열). */
function styleOverrides(opts: RenderStyleOpts): string {
  const decls: string[] = []
  const accent = sanitizeHexColor(opts.accent)
  if (accent) decls.push(`--accent-user: ${accent};`)
  if (opts.font === 'serif') decls.push(`--font-user: ${SERIF_STACK};`)
  if (opts.width && WIDTHS[opts.width]) decls.push(`--maxw: ${WIDTHS[opts.width]};`)
  const root = decls.length ? `  :root { ${decls.join(' ')} }\n` : ''
  const center =
    opts.align === 'center'
      ? `  .tdk-head { text-align: center; }\n  .tdk-meta, .tdk-orgline { justify-content: center; }\n`
      : ''
  return root + center
}

/**
 * 헤더 아이콘 — 로고가 있으면 모노그램 위에 이미지를 겹쳐 출력(로드 실패 시 alt="" 로
 * 모노그램이 비쳐 보이는 무JS 폴백). data: 등 비 http(s) URL 은 방어적으로 무시.
 */
function renderOrgIconHtml(dto: PublicRenderDto): string {
  const initial = [...dto.orgName.trim()][0]?.toUpperCase() ?? '?'
  const safeLogo =
    dto.orgLogoUrl && /^https?:\/\//i.test(dto.orgLogoUrl)
      ? `<img src="${escapeHtml(dto.orgLogoUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
      : ''
  return `<span class="tdk-icon" aria-hidden="true">${escapeHtml(initial)}${safeLogo}</span>`
}

/**
 * 완전 독립형(self-contained) 약관 HTML 문서 — iframe 임베드/팝업/직접 링크용.
 * 외부 의존성 없음, 반응형, 라이트/다크, 인쇄 스타일 포함. 강조색·폰트·정렬·폭 커스터마이즈 가능.
 */
export function renderPolicyDocument(dto: PublicRenderDto, opts: RenderStyleOpts = {}): string {
  // theme 은 공개 쿼리에서 임의 문자열로 들어올 수 있으므로(런타임 캐스트일 뿐)
  // 속성 삽입 전에 화이트리스트로 강제한다 — 반사형 XSS 차단.
  const theme = opts.theme === 'light' || opts.theme === 'dark' ? opts.theme : 'auto'
  const themeAttr = theme === 'auto' ? '' : ` data-theme="${theme}"`
  const overrides = styleOverrides(opts)
  const title = `${escapeHtml(dto.name)} · ${escapeHtml(dto.orgName)}`
  return `<!doctype html>
<html lang="${escapeHtml(dto.locale || 'ko')}"${themeAttr}>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="index, follow" />
<title>${title}</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #fbfaf7; --surface: #ffffff; --text: #1c1a17; --muted: #6b6760;
    --subtle: #9a958c; --border: #e9e5dd;
    --accent: var(--accent-user, #b45309);
    --accent-soft: color-mix(in srgb, var(--accent) 14%, var(--surface));
    --font: var(--font-user, ${SANS_STACK});
    --radius: 14px; --maxw: 46rem;
  }
  [data-theme="dark"], :root.tdk-dark {
    --bg: #16140f; --surface: #1f1c16; --text: #f1ede4; --muted: #b3ad9f;
    --subtle: #807b6f; --border: #322d23; --accent: var(--accent-user, #f59e0b);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #16140f; --surface: #1f1c16; --text: #f1ede4; --muted: #b3ad9f;
      --subtle: #807b6f; --border: #322d23; --accent: var(--accent-user, #f59e0b);
    }
  }
${overrides}  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    background: var(--bg); color: var(--text); font-family: var(--font);
    line-height: 1.75; font-size: 16px; padding: clamp(16px, 4vw, 40px);
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  }
  .tdk-doc { max-width: var(--maxw); margin: 0 auto; }
  .tdk-head { border-bottom: 1px solid var(--border); padding-bottom: 20px; margin-bottom: 28px; }
  .tdk-orgline { display: flex; align-items: center; gap: 9px; }
  .tdk-icon { position: relative; display: inline-grid; place-items: center; width: 28px;
    height: 28px; flex: none; border-radius: 8px; overflow: hidden; background: var(--accent-soft);
    color: var(--accent); font-size: 13px; font-weight: 700; }
  .tdk-icon img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .tdk-org { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.02em; color: var(--accent);
    text-transform: uppercase; }
  .tdk-title { font-size: clamp(1.5rem, 4vw, 2rem); font-weight: 700; margin: 6px 0 14px;
    letter-spacing: -0.01em; line-height: 1.25; }
  .tdk-meta { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 0.82rem; color: var(--muted); }
  .tdk-meta b { color: var(--text); font-weight: 600; }
  .tdk-badge { display: inline-flex; align-items: center; gap: 6px; background: var(--accent-soft);
    color: var(--accent); font-weight: 600; border-radius: 999px; padding: 2px 10px; font-size: 0.78rem; }
  .tdk-body { font-size: 1rem; }
  .tdk-h { font-size: 1.06rem; font-weight: 700; margin: 26px 0 6px; letter-spacing: -0.005em; }
  .tdk-h:first-child { margin-top: 0; }
  .tdk-p { margin: 0 0 2px; color: var(--text); word-break: keep-all; overflow-wrap: anywhere; }
  .tdk-gap { height: 12px; }
  .tdk-ul { margin: 2px 0 6px; padding-left: 1.15em; }
  .tdk-li { margin: 0 0 2px; color: var(--text); word-break: keep-all; overflow-wrap: anywhere; }
  .tdk-foot { margin-top: 40px; padding-top: 18px; border-top: 1px solid var(--border);
    font-size: 0.74rem; color: var(--subtle); line-height: 1.6; }
  .tdk-hash { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    word-break: break-all; color: var(--muted); }
  .tdk-foot a { color: var(--muted); }
  @media print {
    body { padding: 0; font-size: 11pt; background: #fff; color: #000; }
    .tdk-foot { color: #555; }
  }
</style>
</head>
<body>
  <main class="tdk-doc">
    <header class="tdk-head">
      <div class="tdk-orgline">
        ${renderOrgIconHtml(dto)}
        <div class="tdk-org">${escapeHtml(dto.orgName)}</div>
      </div>
      <h1 class="tdk-title">${escapeHtml(dto.name)}</h1>
      <div class="tdk-meta">
        <span class="tdk-badge">${escapeHtml(dto.versionLabel)}</span>
        <span>시행일 <b>${formatDate(dto.effectiveAt)}</b></span>
        <span>게시일 <b>${formatDate(dto.publishedAt)}</b></span>
      </div>
    </header>
    <article class="tdk-body">
${renderBodyHtml(dto.body)}
    </article>
    <footer class="tdk-foot">
      <div>이 문서는 변조 방지 게시본입니다. 콘텐츠 해시(SHA-256):
        <span class="tdk-hash">${escapeHtml(dto.contentHash || '—')}</span></div>
      <div style="margin-top:6px">Powered by TermsDesk</div>
    </footer>
  </main>
</body>
</html>`
}

/**
 * 드롭인 임베드 위젯. 고객 사이트는 `<script src=".../api/public/embed.js">` 한 줄과
 * `data-termsdesk-policy` 트리거만 추가하면 클릭 시 모달로 약관이 열립니다.
 * 외부 의존성 0, 데스크톱 모달 + 모바일 바텀시트, ESC/백드롭 닫기, 포커스 복원.
 */
export const EMBED_SCRIPT = `(function () {
  var script = document.currentScript;
  function attr(name, fallback) {
    return (script && script.getAttribute(name)) || fallback;
  }
  var origin = script && script.src ? new URL(script.src).origin : location.origin;
  var base = attr('data-base', origin).replace(/\\/$/, '');
  var apiBase = base + '/api/public';
  var defOrg = attr('data-org', '_');
  var defTheme = attr('data-theme', 'auto');
  var STYLE_ID = 'tdk-embed-style';
  var lastFocus = null;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = ''
      + '.tdk-ov{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;'
      + 'justify-content:center;padding:24px;background:rgba(20,18,14,.55);'
      + 'backdrop-filter:blur(2px);opacity:0;transition:opacity .18s ease}'
      + '.tdk-ov.tdk-on{opacity:1}'
      + '.tdk-sheet{position:relative;width:100%;max-width:720px;height:min(86vh,860px);'
      + 'background:#fff;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;'
      + 'box-shadow:0 24px 60px -12px rgba(0,0,0,.4);transform:translateY(8px) scale(.99);'
      + 'transition:transform .2s cubic-bezier(.22,1,.36,1)}'
      + '.tdk-ov.tdk-on .tdk-sheet{transform:none}'
      + '.tdk-bar{display:flex;align-items:center;justify-content:flex-end;padding:8px;'
      + 'position:absolute;top:0;right:0;z-index:2}'
      + '.tdk-x{appearance:none;border:0;background:rgba(0,0,0,.05);width:34px;height:34px;'
      + 'border-radius:9px;cursor:pointer;font-size:20px;line-height:1;color:#3a352c}'
      + '.tdk-x:hover{background:rgba(0,0,0,.1)}'
      + '.tdk-frame{border:0;width:100%;height:100%;flex:1;background:#fbfaf7}'
      + '@media (max-width:640px){.tdk-ov{padding:0;align-items:flex-end}'
      + '.tdk-sheet{height:92vh;max-width:none;border-radius:18px 18px 0 0}}';
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  function buildUrl(opts) {
    var org = opts.org || defOrg;
    var slug = opts.policy;
    var url = apiBase + '/' + encodeURIComponent(org) + '/policies/' + encodeURIComponent(slug) + '/html';
    var qs = [];
    qs.push('theme=' + encodeURIComponent(opts.theme || defTheme));
    if (opts.version) qs.push('version=' + encodeURIComponent(opts.version));
    var style = ['accent', 'font', 'align', 'width'];
    for (var s = 0; s < style.length; s++) {
      var sv = opts[style[s]] || attr('data-' + style[s], '');
      if (sv) qs.push(style[s] + '=' + encodeURIComponent(sv));
    }
    var vars = opts.vars || {};
    for (var k in vars) {
      if (Object.prototype.hasOwnProperty.call(vars, k)) {
        qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(vars[k]));
      }
    }
    return url + '?' + qs.join('&');
  }

  function close(ov) {
    ov.classList.remove('tdk-on');
    document.documentElement.style.removeProperty('overflow');
    setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 180);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function open(opts) {
    if (!opts || !opts.policy) return;
    injectStyle();
    lastFocus = document.activeElement;
    document.documentElement.style.overflow = 'hidden';
    var ov = document.createElement('div');
    ov.className = 'tdk-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', opts.label || '약관 보기');
    var sheet = document.createElement('div');
    sheet.className = 'tdk-sheet';
    var bar = document.createElement('div');
    bar.className = 'tdk-bar';
    var x = document.createElement('button');
    x.className = 'tdk-x';
    x.setAttribute('aria-label', '닫기');
    x.innerHTML = '&times;';
    x.addEventListener('click', function () { close(ov); });
    bar.appendChild(x);
    var frame = document.createElement('iframe');
    frame.className = 'tdk-frame';
    frame.setAttribute('title', opts.label || '약관');
    frame.src = buildUrl(opts);
    sheet.appendChild(bar);
    sheet.appendChild(frame);
    ov.appendChild(sheet);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(ov); });
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('tdk-on'); x.focus(); });
    function onKey(e) { if (e.key === 'Escape') { close(ov); document.removeEventListener('keydown', onKey); } }
    document.addEventListener('keydown', onKey);
  }

  function readVars(el) {
    var vars = {};
    var list = el.attributes;
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (a.name.indexOf('data-termsdesk-var-') === 0) {
        vars[a.name.slice('data-termsdesk-var-'.length)] = a.value;
      }
    }
    return vars;
  }

  function onClick(e) {
    var el = e.target.closest ? e.target.closest('[data-termsdesk-policy]') : null;
    if (!el) return;
    e.preventDefault();
    open({
      policy: el.getAttribute('data-termsdesk-policy'),
      org: el.getAttribute('data-termsdesk-org'),
      version: el.getAttribute('data-termsdesk-version'),
      theme: el.getAttribute('data-termsdesk-theme'),
      accent: el.getAttribute('data-termsdesk-accent'),
      font: el.getAttribute('data-termsdesk-font'),
      align: el.getAttribute('data-termsdesk-align'),
      width: el.getAttribute('data-termsdesk-width'),
      label: el.getAttribute('data-termsdesk-label') || el.textContent,
      vars: readVars(el)
    });
  }

  document.addEventListener('click', onClick);
  globalThis.TermsDesk = { open: open };
})();
`
