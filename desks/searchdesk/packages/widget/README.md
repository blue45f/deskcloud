# @searchdesk/widget

형제 앱·고객 사이트에 임베드하는 SearchDesk **검색 위젯**.

- **`<SearchPalette/>`** — <kbd>⌘</kbd><kbd>K</kbd> 커맨드 팔레트 오버레이. 입력 → 디바운스
  검색 → 카테고리 그룹 결과 → 키보드 내비(↑/↓/Enter, Esc 닫기) → 하이라이트.
- **`<SearchBox/>`** — 인라인 검색 박스(콤보박스 + 드롭다운 패널).

의존성은 `react`(peer)뿐, 외부 CSS 프레임워크 0(스코프 `.sk-*` CSS). 검색은
**publishable(`pk_`) 키**만 쓰므로 브라우저에 안전합니다(테넌트별 CORS 허용목록으로 보호).

## 백엔드 계약 (publishable 검색)

- `GET {endpoint}/api/search?q=&index=&category=&tags=&limit=` (Authorization: Bearer pk_…)
  → 랭킹 hits + `titleHighlight`/`snippet`(`<mark>`) + facets(category·tags)

## React: ⌘K 팔레트

```tsx
import { SearchPalette } from '@searchdesk/widget'

<SearchPalette
  publishableKey="pk_…"
  endpoint="https://search.example.com"
  indexName="docs"          // 선택 — 기본 'default'
  hotkey="mod+k"            // 선택 — ⌘/Ctrl+K (기본)
  accent="#2f5fe0"          // 선택
  onSelect={(hit) => router.push(hit.url ?? '/')}  // 선택 — 기본은 hit.url 로 이동
/>
```

전역 핫키로 자동으로 열립니다. 직접 열고 닫으려면 제어 모드:

```tsx
const [open, setOpen] = useState(false)
<SearchPalette publishableKey="pk_…" endpoint="…" open={open} onClose={() => setOpen(false)} />
```

## React: 인라인 박스

```tsx
import { SearchBox } from '@searchdesk/widget'

<SearchBox publishableKey="pk_…" endpoint="https://search.example.com" placeholder="검색…" />
```

## 바닐라(비-React) 임베드

빌드하면 `dist/search-widget.js`(IIFE, react 인라인)가 생성됩니다. 비-React 페이지에서:

```html
<script src="https://search.example.com/search-widget.js"></script>
<script>
  // ⌘K 팔레트(전역 핫키)
  SearchDesk.init({ publishableKey: 'pk_…', endpoint: 'https://search.example.com' })
  // 또는 인라인 박스
  SearchDesk.mountBox({ publishableKey: 'pk_…', endpoint: '…', target: '#search' })
</script>
```

## 단일 파일 벤더 버전

npm publish 가 막힌 동안에는 `apps-vendor/SearchPalette.tsx` 를 형제 앱에 그대로 복붙해서
씁니다(워크스페이스 의존 0, react 만 필요). 동작/디자인 동일.

## 빌드 / 검증

```bash
pnpm --filter @searchdesk/widget run build       # tsup(ESM/CJS/d.ts) + vite IIFE
pnpm --filter @searchdesk/widget run typecheck
pnpm --filter @searchdesk/widget run test
```

## 데모

```bash
pnpm --filter @searchdesk/api run dev            # 로컬 API (:4093, PGlite + 데모 시드)
pnpm --filter @searchdesk/widget run dev:demo    # 데모 (http://127.0.0.1:5296)
```

## 접근성 · 디자인

- `role="dialog"`+`aria-modal`(팔레트), 포커스 트랩, Esc 닫기, 열기 전 포커스 복귀
- input `role="combobox"`+`aria-expanded`/`aria-controls`/`aria-activedescendant`,
  결과 `role="listbox"`/`role="option"`+`aria-selected`
- ↑/↓ 이동·Enter 선택·Esc 닫기, 활성 행 자동 스크롤, 호버 동기화
- `:focus-visible` 만 링 표시, `prefers-reduced-motion` 존중, 본문 대비 ≥ 4.5:1
- 그라디언트 텍스트/기본 글래스모피즘/사이드-스트라이프 보더 없음, 시맨틱 z-index
- 하이라이트 `<mark>` 는 서버가 이스케이프 후 삽입(XSS 안전)
