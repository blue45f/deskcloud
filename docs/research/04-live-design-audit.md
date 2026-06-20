# LIVE 비주얼 디자인 감사 — DeskCloud · spa-seo-gateway · remote-devtools

세 사이트 모두 LIVE 렌더 확인. 각 사이트의 랜딩 + 관리자/대시보드 표면을 실제 브라우저에서 탐색하고, 접근성 스냅샷 + 렌더된 computed-style 토큰을 함께 추출했습니다. (스크린샷은 Playwright MCP 서버의 격리된 작업 디렉터리에 저장되어 로컬 FS에서 읽히지 않았으므로, 시각 분석은 스냅샷 + getComputedStyle 실측 토큰 기반입니다.)

---

## 1. 사이트별 디자인 언어 요약

### A. DeskCloud — `desk-platform.vercel.app` (패밀리 포털 / 카탈로그·요금제)
- **정체성**: 마케팅 SaaS 포털 (상단바 + 히어로 + 가치 그리드 + SDK 설치 + 서비스 디렉터리 + 단계 + CTA + 풋터). 14개 Desk를 묶는 "엄브렐러 브랜드".
- **컬러**: 순수 **OKLCH 토큰 시스템**. 거의 흰 배경 `oklch(99.4% .003 260)`, 잉크 `oklch(26% .02 270)`. 액센트 = **바이올렛/인디고, hue 277** (`--color-accent: oklch(62% .18 277)`, strong 55%). 시맨틱 풀(success 150 / info 230 / warning 60 / danger 25)까지 OKLCH로 완비. surface/border 단계가 명도 기반으로 정연.
- **타이포**: **Pretendard Variable** (한글 최적). h1 57.6px / weight 600 / letter-spacing −1.44px (타이트). 본문 14px. mono = ui-monospace 폴백.
- **밀도/스페이싱**: 넓은 마케팅 여백. 카드 radius 12→16px(단계 카드 24px 패딩), 버튼 radius 8px.
- **컴포넌트**: 잉크색 채움 프라이머리 버튼(`oklch(24%)` bg), 보더형 세컨더리(1px border + surface bg), 코드 스니펫 + 복사 버튼 + 패키지매니저 탭(npm/pnpm/yarn/bun), 다크모드 토글.
- **헤더/IA**: sticky, 반투명 + `blur(8px)`, 하단 1px 보더, 57px. 내비 = 카탈로그/요금제/문서/사이트맵 + 로그인/시작하기. "DeskCloud · BETA" 워드마크.
- **관리자 표면**: `/dashboard` → `/login` 리다이렉트. 로그인은 **secret 키(`sk_…`)/ADMIN_TOKEN을 Bearer로 입력**하는 단일 필드. 콘솔 chrome 자체는 키 없이 도달 불가 — 즉 **운영 콘솔 UI가 공개 표면에 없음**. 로그인 페이지는 마케팅 shell(헤더/풋터)을 그대로 재사용.
- **브랜드 필**: 차분하고 정밀한 "플랫폼 코어" 느낌. 절제된 바이올렛, 한글 최적 타이포, 토큰 규율이 강함.

### B. spa-seo-gateway — `spa-seo-gateway.vercel.app` (루트가 곧 관리자 콘솔)
- **정체성**: 랜딩이 아니라 **풀 운영자 콘솔**. 루트 타이틀부터 "spa-seo-gateway 관리자". 좌측 레일 + 우측 콘텐츠.
- **IA/내비**: **고정 좌측 사이드바(240px, 다크 인디고 레일 `lab(7.8%)`)**. 16개 항목(소개/대시보드/에이전트 제어/라우트/캐시/워밍/렌더 테스트/메트릭/Lighthouse/시각 회귀/AI Schema/감사 로그/API/라이브러리/도움말) — public 항목엔 배지. 레일 하단에 인증 상태("미인증") + GitHub + **테마 토글(system) + 밀도 토글(comfortable) + 한/영 전환**.
- **컬러**: **Tailwind v4 베이스 + 커스텀 `--app-*` 콘솔 테마**(LAB 공간). 라이트 surface `lab(97%)`, panel `lab(99.4%)`. 액센트 = **인디고 `lab(43.85% 33 -63.5)`** (보라끼 도는 파랑). 시맨틱 ok/warn/err + 각각 bg/fg + **별도 다크 레일 토큰군(`--app-rail*`)**.
- **타이포**: **시스템 산세리프**(`ui-sans-serif`) — 전용 웹폰트 없음. h1/h2 20px/600/−0.5px (콘솔답게 작은 제목). 본문 16px.
- **밀도/컴포넌트**: 데이터 밀도 높음. 패널 카드 radius 10px + 1px 라인 보더 + 아주 옅은 그림자, 패딩 20px. KPI 통계칸(모드/Origin/Uptime/Node), 데모 체크리스트 + progressbar, ASCII 아키텍처 다이어그램. 내비 active 항목 = 인디고 채움 + 흰 텍스트 + radius 6px.
- **브랜드 필**: "엔지니어용 인프라 대시보드". 기능적, 조밀, 다크 레일 + 인디고. 마케팅 광택보다 **운영 도구** 감성.

### C. remote-devtools — `remote-devtools.vercel.app` (마케팅 랜딩 + 별도 라이브 대시보드)
- **랜딩 정체성**: 세련된 **개발자-마케팅 랜딩**. 히어로("어떤 웹 페이지든 원격으로 디버깅") + 임베디드 대시보드 목업(브라우저 크롬 프레임 안에 미니 대시보드) + 통계 스트립(8.4k+/rrweb v2/MIT/0 DB) + 6칸 기능 그리드 + 빠른시작 탭(Module/Script/Docker) + 키보드 단축키 CTA(G D / G S / ⌘K).
- **컬러**: 거의 흰 배경, 잉크 **`#171717`**(near-black). 액센트 = **블루 `hsl(217 91% 60%)`** (HSL 토큰: `--accent`/`--ring`/`--accent-soft`). Tailwind v4 OKLCH 팔레트 + HSL 시맨틱 레이어 혼재. 프라이머리 버튼은 **near-black 채움**(액센트 아님) — 모노크롬 시크.
- **타이포**: **Inter Variable** + **JetBrains Mono Variable**. h1 60px/600/−1.5px, h2 36px/600/−0.9px. 본문 16px. 타이트한 트래킹.
- **밀도/컴포넌트**: 버튼 radius 5–7px(상대적으로 작음/샤프), shadow 토큰 4단계(xs~lg). 헤더 sticky 반투명 + **`blur(24px)`**, 57px, 1px 보더.
- **관리자/대시보드 표면(LIVE 도달)**: `/dashboard`가 **실제로 렌더되는 풀 콘솔**. 좌측 접이식 사이드바(232px, 투명 bg + 1px 우보더, 섹션 그룹 "SDK 실험실") + **상단바(breadcrumb + 데모 배지 + 테마 토글 + ⌘K 검색/커맨드 팔레트, 56px)** + KPI 스탯 카드(radius 14px) + 차트 + 라이브 활동 피드. 내비 active = `rgb(245,245,245)` 옅은 채움 + radius 7px, idle = `rgb(97,97,97)` 회색. 데모 모드(0 DB, 시드 데이터).
- **브랜드 필**: Vercel/Linear 계열의 "모노크롬 + 블루 포인트, Inter 타이트" 모던 개발자 도구. 셋 중 시각적으로 가장 동시대적이고 폴리시가 높음.

---

## 2. 현재 정렬도 — **같은 가족인가, 세 가지 다른 룩인가?**

**결론: 사실상 세 가지 다른 룩.** 공통 DNA는 약하고, 표면적 수렴만 존재.

**공유하는 점(약한 공통 분모):**
- 셋 다 거의-흰 라이트 테마 + near-black 잉크 + 단일 채도 액센트(전부 파랑~보라 계열) + 테마 토글 + skip-link/한국어 + Vercel 호스팅.
- 셋 다 termsdesk 지원 링크로 연결됨(`termsdesk.vercel.app/support/...`) — 운영 백오피스는 이미 한 곳으로 모임.

**갈라지는 점(정렬을 깨는 핵심):**
| 축 | DeskCloud | spa-seo-gateway | remote-devtools |
|---|---|---|---|
| 색공간/토큰 | **OKLCH** `--color-*` | **LAB** `--app-*`(Tailwind v4) | **HSL** `--accent` + OKLCH 팔레트 |
| 액센트 | 바이올렛 hue 277 | 인디고 `lab 43/33/-63` | 블루 `hsl 217 91 60` |
| 폰트 | **Pretendard** | **시스템 산세리프**(폰트 없음) | **Inter + JetBrains Mono** |
| 프라이머리 버튼 | 잉크 채움 r8 | 인디고 채움 r6 | near-black 채움 r7 |
| 섀시 | sticky 헤더(마케팅) | 다크 좌측 레일 콘솔 | sticky 헤더 + 별도 좌측 콘솔 |
| 관리자 chrome | 키 없이 **없음** | 자체 콘솔(테마+밀도 토글) | 자체 콘솔(⌘K 팔레트) |
| 워드마크/배지 | DeskCloud·BETA | admin console | v1.0 오픈베타 |

→ 토큰 이름·색공간·폰트·버튼 형태·콘솔 섀시가 **세 개의 독립 디자인 시스템**. "DeskCloud 패밀리"라는 카탈로그상의 약속(14 Desk + 코어)과 달리, 이 두 후보(spa-seo-gateway·remote-devtools)는 **시각적으로 패밀리에 속해 보이지 않음**. remote-devtools 콘솔이 품질 최상, DeskCloud가 토큰 규율 최강, spa-seo-gateway가 콘솔 IA(밀도/테마 토글) 최성숙 — 강점이 서로 다른 코드베이스에 흩어져 있음.

---

## 3. 통합 디자인 시스템 + 통합 어드민 셸 롤아웃 — 구체적 요구사항

목표: 두 후보(spa-seo-gateway·remote-devtools)가 **일급 DeskCloud Desk**처럼 보이게. 공유 셸/내비/인증, 토큰, 타이포, Desk별 액센트, "Powered by DeskCloud" 배지, 단일 오퍼레이터 콘솔 크롬 + Desk별 패널.

### 3.1 토큰 — 단일 색공간으로 수렴 (소스 = DeskCloud의 OKLCH)
- **DeskCloud의 `--color-*` OKLCH 세트를 정전(canonical)으로** 채택(`@heejun/web-config-preset` 또는 `@desk/tokens` 패키지로 발행). spa-seo-gateway의 LAB `--app-*`와 remote-devtools의 HSL `--accent`를 **이 토큰의 별칭으로 재매핑**(예: `--app-accent: var(--desk-accent)`), 컴포넌트 코드는 안 건드리고 변수 레이어만 교체.
- **Desk별 액센트 = hue 토큰 1개만 교체**: 코어 277(바이올렛) 고정, `--desk-accent-hue`만 Desk마다 다르게 — spa-seo-gateway ≈ 265~277(인디고), remote-devtools ≈ 230~250(블루). chroma/lightness 곡선은 공유 → "같은 시스템, 다른 강조색"이 자동 성립. 시맨틱(ok/warn/err)·surface·border·라인 스케일은 **전 Desk 동일**.
- 라이트/다크 모두 토큰으로 정의(remote-devtools·spa-seo-gateway는 이미 토글 보유, DeskCloud도 보유 → 다크 토큰만 통일).

### 3.2 타이포 — 1폰트 + 1모노로 통일
- **Pretendard Variable(코어, 한글) + 본문, JetBrains Mono Variable(코드)** 를 전 Desk 표준. spa-seo-gateway의 시스템폰트, remote-devtools의 Inter를 Pretendard로 교체(라틴은 Pretendard가 충분, 또는 Inter→Pretendard fallback 체인). 헤딩 스케일/트래킹(h1 −1.44~−1.5px tight)도 토큰화(`--text-*` + `--tracking-*`)해 공유.

### 3.3 통합 어드민 셸 (`@desk/console-shell`) — 단일 오퍼레이터 크롬
세 콘솔이 제각각 가진 좋은 부분을 한 컴포넌트로 합성:
- **좌측 레일**(spa-seo-gateway의 240px 다크 인디고 레일 패턴을 베이스) — 단, 코어 토큰의 `--rail-*`로. 접이식(remote-devtools 보유) + 섹션 그룹핑(둘 다 보유).
- **상단바**: breadcrumb + 환경 배지(데모/프로덕션) + **⌘K 커맨드 팔레트**(remote-devtools 보유 → 셸 표준으로 승격) + 테마 토글 + **밀도 토글**(spa-seo-gateway 보유 → 표준) + 한/영 전환.
- **Desk별 패널 슬롯**: 셸은 rail/topbar/breadcrumb/auth/팔레트만 소유하고, 각 Desk는 `<DeskPanel>` 자식만 주입(remote-devtools=세션/리플레이, spa-seo-gateway=라우트/캐시/워밍/메트릭). 내비 항목은 Desk가 매니페스트로 등록.
- active/idle 내비 스타일, 카드 radius(10~14px로 단일 값 합의), shadow 토큰 4단계(remote-devtools 세트 채택)도 셸이 강제.

### 3.4 통합 인증
- **DeskCloud의 secret-key/Bearer 로그인**(`sk_…` + `Authorization: Bearer`)을 셸의 공유 auth 게이트로. 현재 spa-seo-gateway는 우측 상단 토큰 박스, remote-devtools는 데모 모드 — 둘 다 **셸의 단일 로그인/세션 칩 + "미인증/데모/프로덕션" 상태 표시기**로 통일. 로그인 후 `publishable/secret` 키 한 쌍으로 전 패밀리 인증(포털 약속과 일치).

### 3.5 "Powered by DeskCloud" 배지
- 셸 풋터/사이드바 하단에 **표준 "Powered by DeskCloud" 배지 컴포넌트**(코어 워드마크 + `/` 패밀리 링크)를 전 Desk에 삽입. 현재 spa-seo-gateway="admin console", remote-devtools="v1.0 오픈베타"인 자리 표시를 이 배지로 교체 → 카탈로그(`/catalog`)와 양방향 연결.

### 3.6 헤더/마케팅 표면 정렬
- 두 후보의 **마케팅 랜딩 헤더**(remote-devtools는 보유, spa-seo-gateway는 콘솔뿐이라 별도 소개 페이지만 있음)를 DeskCloud의 sticky·`blur`·57px·1px 보더 패턴 + 코어 워드마크 lockup으로 통일. 내비 우측에 "DeskCloud 패밀리로 돌아가기" 링크 추가.

### 3.7 롤아웃 순서(현실적)
1. `@desk/tokens`(OKLCH) + `@desk/typography` 발행 → 두 후보에서 변수 별칭 레이어만 교체(저위험, 컴포넌트 무변경).
2. `@desk/console-shell` 추출(remote-devtools 콘솔을 골격으로, spa-seo-gateway의 밀도토글/레일 흡수) → 각 Desk는 패널만 주입.
3. 공유 auth 게이트 + "Powered by DeskCloud" 배지 + 마케팅 헤더 lockup 적용.
4. Desk별 `--desk-accent-hue`만 다르게 설정해 "한 시스템, Desk별 강조색" 완성.

**핵심 한 줄**: 세 사이트는 지금 *세 개의 디자인 시스템*(OKLCH/LAB/HSL · Pretendard/시스템/Inter · 마케팅헤더/다크레일/콘솔)이다. DeskCloud의 OKLCH 토큰 + Pretendard를 정전으로 삼고, remote-devtools의 콘솔 골격(⌘K·접이식 레일·스탯카드)에 spa-seo-gateway의 콘솔 성숙도(밀도토글·다중 패널 IA)를 합쳐 단일 `@desk/console-shell`을 만들면, hue 토큰 하나만 Desk별로 바꿔 두 후보를 일급 DeskCloud Desk로 승격할 수 있다.