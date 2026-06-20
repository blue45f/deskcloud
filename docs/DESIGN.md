# DESIGN.md — TermsDesk

product 레지스터. Restrained 색 전략. 라이트 기본 + 다크 지원. Tailwind v4 (`@theme`) + Radix + cva.

## Theme 결정 (scene sentence)

> 낮 시간 사무실 24인치 모니터 앞에서, 컴플라이언스 담당자가 "지금 어떤 약관 버전이 발효 중이고
> 누가 동의했는지"를 신뢰하며 빠르게 확인한다.

→ 밝은 사무 환경, 신뢰 중심, 원장(ledger) → **라이트가 기본**, 다크는 야근/선호 대응으로 지원.

## Color (OKLCH, 카테고리 반사 회피)

컴플라이언스 반사색(네이비/틸/그린)과 개발툴 반사색(인디고)을 피한다.
정체성 = **잉크(ink) + 따뜻한 종이(paper) 중성 + 앰버 "인장(seal)" 강조**. 도장·등록부 메타포.

- **Primary action = ink** (카테고리 색 없이 near-black 버튼; Vercel/Linear 계열). 다크에서는 반전.
- **Accent = seal amber** (로고, 활성 내비, 현재 버전 마커, 포커스 링, 핵심 링크). 표면의 ≤10%.
- 중성은 따뜻하게 틴트(paper). `#000/#fff` 금지.

라이트 토큰:

- `--bg`: oklch(0.994 0.003 90) · `--surface`: oklch(0.985 0.004 90) · `--surface-2`: oklch(0.965 0.005 85)
- `--border`: oklch(0.915 0.005 85) · `--border-strong`: oklch(0.86 0.006 85)
- `--text`: oklch(0.26 0.012 75) · `--text-muted`: oklch(0.52 0.012 80) · `--text-subtle`: oklch(0.63 0.01 80)
- `--ink`(primary): oklch(0.24 0.012 75) · `--ink-hover`: oklch(0.30 0.014 75)
- `--accent`: oklch(0.70 0.13 70) · `--accent-strong`: oklch(0.62 0.14 65) · `--accent-soft`: oklch(0.95 0.04 80)

다크 토큰:

- `--bg`: oklch(0.20 0.008 80) · `--surface`: oklch(0.235 0.008 80) · `--surface-2`: oklch(0.27 0.009 80)
- `--border`: oklch(0.32 0.009 80) · `--text`: oklch(0.93 0.006 85) · `--text-muted`: oklch(0.72 0.01 82)
- `--ink`(primary in dark = near-white): oklch(0.94 0.006 85), 텍스트는 잉크 대비
- `--accent`: oklch(0.76 0.13 72) · `--accent-soft`: oklch(0.30 0.05 70)

세만틱(기능색, 정체성과 분리·저채도):

- success/published: oklch(0.62 0.13 150) · info/scheduled: oklch(0.60 0.10 240)
- warning/reconsent: oklch(0.70 0.15 60) · danger: oklch(0.58 0.18 25) · neutral/draft·archived: 중성 회색

상태 매핑 (StatusPill):

- `published` 발효 = success(점+라벨) · `draft` 초안 = neutral · `scheduled` 예약 = info
- `archived` 보관 = muted · `requires_reconsent` = warning(앰버)
- 동의 결정: `accepted` = success · `declined` = danger-rose · `withdrawn` = neutral

## Typography

- 한국어 B2B → **Pretendard Variable** 우선, system 폴백. 단일 패밀리로 헤딩/본문/라벨/데이터.
  스택: `Pretendard Variable, Pretendard, -apple-system, system-ui, "Segoe UI", sans-serif`
- 해시·코드·키: mono `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`
- 고정 rem 스케일(유체 금지), 비율 ~1.2. 본문 14px(0.875rem) 기준, 데이터 13px 허용.
  step: 12 / 13 / 14 / 16 / 18 / 22 / 28 / 36. weight 대비로 위계(400/500/600/700).
- 산문 65–75ch, 표/데이터는 더 밀도 높게 허용.

## Spacing · radius · elevation

- 4px 베이스. 리듬을 위해 패딩 변주(균일 패딩 지양).
- radius: sm 6 / md 8 / lg 12(카드) / xl 16 / full(pill). 입력·버튼 8.
- shadow: 잉크 틴트 저투명 다층. `xs`(보더 대체), `sm`(드롭다운), `md`(팝오버/시트), `lg`(모달).
  장식적 큰 그림자 금지. 카드는 보더 우선, 그림자는 떠 있는 요소만.

## Layout — 앱 셸

- 데스크톱: 좌측 고정 **사이드바**(240px, 워드마크 + 내비 + 조직/모드 배지 + 사용자) + 콘텐츠.
  상단 얇은 **탑바**(현재 위치 타이틀/브레드크럼 + 우측 액션 + 다크모드 토글).
- 모바일(<1024px): 사이드바 → **드로어**(Radix Dialog as sheet), 탑바에 햄버거.
- 콘텐츠 최대폭: 일반 1100px, 산문/에디터 760ch-class, 표는 풀폭.
- 예측 가능한 그리드. 표준 내비 패턴 유지(발명 금지).

## 핵심 컴포넌트 방향

모든 인터랙티브 요소: default/hover/focus/active/disabled/loading/error 전부 구현. 일관된 어휘.

- **Button** (cva): variant = primary(ink) / secondary(surface+border) / ghost / outline / danger / accent.
  size = sm/md/lg. loading 시 스피너+disabled. focus-visible 앰버 링 2px+offset.
- **Card**: 보더 기본, 그림자 없음. 중첩 금지. 꼭 필요할 때만.
- **Badge / StatusPill**: 점(dot) + 라벨, 저채도 배경 틴트. side-stripe 금지.
- **Table**: 헤더 sticky, 행 hover, zebra 없음(보더 구분), 밀도 compact. 모바일은 카드형 스택으로 전환.
- **Dialog / Sheet**(Radix): 모달은 최후 수단. 오버레이 잉크 저투명, 콘텐츠 라운드 lg.
- **Tabs**(Radix): 밑줄형, 활성 앰버.
- **Timeline**(버전 히스토리): 좌측 레일 + 노드(현재=앰버 채움, 게시=success 점, 초안=중성 링),
  각 노드에 버전 라벨·해시 short·발효일·게시자. 불변성 강조(자물쇠 아이콘).
- **DiffView**: 라인 단위 unified diff. 추가=success 틴트 배경+`+`, 삭제=danger 틴트+`-`, 동일=중성.
  좌우 split 토글(데스크톱). content-hash 변화 강조.
- **EmptyState**: 인터페이스를 가르치는 빈 상태(아이콘 + 한 줄 설명 + 다음 액션 버튼). "nothing here" 금지.
- **Skeleton**: 콘텐츠 로딩은 스피너 대신 스켈레톤.

## Motion

- 150–250ms, ease-out (quart/expo). 상태 전달만(장식 금지). 레이아웃 속성 애니메이트 금지.
- `prefers-reduced-motion` 존중(트랜지션 최소화).

## a11y (필수)

- 최상위 ErrorBoundary · SkipLink + `<main id="main-content" tabIndex={-1}>` ·
  라우트 변경 시 본문 포커스 이동 + `aria-live`(role=status) 안내 · 페이지별 `document.title` ·
  `prefers-reduced-motion`. 네이티브 confirm/alert/prompt 금지 → `useConfirm()`/ConfirmDialog.
- 명도 대비 WCAG AA. 포커스 가시성 항상. 키보드 전체 조작.
