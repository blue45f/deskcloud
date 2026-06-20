# TOSS-INAPP — TermsDesk를 토스 미니앱(Apps-in-Toss)으로 노출하기

이미 배포된 웹(`termsdesk.vercel.app`)을 **Apps-in-Toss WebView 미니앱**으로 그대로 노출하는
가이드입니다. 별도 네이티브 코드 없이, 반응형 SPA를 토스 앱 안에서 띄우는 가장 가벼운 경로입니다.

> 전제: TermsDesk 웹은 React + Vite 정적 SPA로 Vercel(`termsdesk.vercel.app`)에 배포되어 있고,
> 모바일 반응형·라이트/다크를 지원합니다. 이 문서는 **WebView 노출 방식**을 다루며, 추후 네이티브
> 풀포팅(Granite)은 마지막 절의 next step 으로 둡니다.

## 1) 등록 개요

Apps-in-Toss는 토스 앱 안에서 동작하는 미니앱(App-in-App) 플랫폼입니다. 미니앱은 두 가지 방식으로
만들 수 있습니다.

- **WebView 방식** — 이미 있는 웹 URL을 토스 WebView로 띄움. TermsDesk처럼 반응형 웹이 준비된
  경우 가장 빠른 진입로.
- **React Native(Granite) 방식** — 네이티브 화면을 직접 구현. 더 깊은 통합이 가능하지만 별도 구현
  비용이 듦.

WebView 미니앱 등록의 큰 흐름:

1. **Apps-in-Toss 개발자센터**에 입점/앱 등록을 진행한다.
2. 미니앱 유형을 **WebView**로 두고, 노출할 **시작 URL**을 `https://termsdesk.vercel.app/` 로
   지정한다.
3. 심사·검토 요건(약관·아이콘·메타 등 운영 정책)을 충족한 뒤 노출한다.

> 등록 화면의 항목·심사 정책은 개발자센터 최신 문서를 따른다. 이 저장소에는 토스 측 계정/심사 자격
> 증명이 포함되지 않으며, 실제 입점은 운영자가 개발자센터에서 진행한다.

## 2) WebView로 반응형 SPA 가리키기

TermsDesk 웹은 정적 SPA라 추가 빌드 변경 없이 그대로 가리킬 수 있습니다.

- **시작 URL**: `https://termsdesk.vercel.app/` (또는 특정 진입 화면, 예: `/app/requests`).
- SPA 라우팅은 클라이언트에서 처리되므로, 토스 WebView 안에서도 기존 라우터(`react-router-dom`)가
  그대로 동작한다.
- 공개 약관 페이지(`/p/:orgSlug/:slug`)나 지원 보드(`/support/:projectSlug`)처럼 로그인 없이 보는
  화면을 시작 URL로 두면 첫 진입 마찰이 가장 적다.

## 3) 모바일 우선 고려

WebView는 사실상 모바일 화면이므로 모바일 우선 기준으로 점검합니다.

- 레이아웃은 이미 모바일 우선 반응형(Tailwind)으로 작성되어 있다. 좁은 폭에서 가로 스크롤이 생기지
  않는지(예: 코드 카드의 `min-w-0`/`overflow-x-auto` 처리) 점검한다.
- 터치 타깃은 충분한 높이(버튼 `h-9`~`h-11`)를 유지한다.
- 다이얼로그는 모바일에서 바텀시트(`DialogContent sheet`)로 열리는 패턴을 그대로 쓴다.
- 안전 영역(노치/홈 인디케이터)과 상단 고정 헤더(`sticky top-0`)가 겹치지 않는지 실제 기기에서
  확인한다.

## 4) `isTossInApp()` 으로 인앱 UI 조정

토스 WebView는 user-agent에 `toss` 토큰을 싣습니다. 이를 근거로 인앱일 때만 UI를 가볍게 바꿀 수
있습니다. 유틸은 `apps/web/src/utils/tossEnv.ts` 에 있습니다.

```ts
import { isTossInApp, useTossInApp } from '@/utils/tossEnv'

// 일반 함수 — 모듈 로드 시점 분기 등
if (isTossInApp()) {
  // 인앱 전용 처리
}

// 컴포넌트 — SSR/하이드레이션 안전(첫 렌더 false, 마운트 후 채움)
function Example() {
  const inApp = useTossInApp()
  // inApp 이면 자체 상단 내비를 숨기는 등 토스 셸과 중복되는 UI 제거
  return inApp ? <Compact /> : <Full />
}
```

활용 예:

- 토스 앱이 이미 상단 바를 제공하므로, 인앱에서는 자체 `TopNav`를 숨기거나 축소한다.
- 외부 링크/새 탭 유도 대신 인앱 내 라우팅으로 흐름을 유지한다.
- "앱 설치/외부 브라우저로 열기" 같은 인앱에서 무의미한 안내를 감춘다.

## 5) 무의존성 점진 도입

- `tossEnv.ts`는 `navigator`만 참조하고 **새 의존성을 추가하지 않는다.** Apps-in-Toss SDK 없이도
  동작한다.
- 인앱 분기는 휴리스틱(추정)이며, 비인앱 환경에는 영향이 없다(기본값 false). 따라서 일반 웹 배포를
  깨지 않고 안전하게 추가할 수 있다.
- 먼저 WebView로 노출해 사용성을 검증하고, 필요해지면 그때 SDK/네이티브 기능을 점진 도입한다.

## 6) Next step — Granite 풀포팅

WebView 노출로 검증을 마친 뒤, 더 깊은 통합이 필요하면 **Granite(구 Bedrock) 프레임워크**로
네이티브 미니앱을 구성하는 것이 다음 단계입니다.

- Granite는 React Native 기반이며, 비게임 미니앱은 **TDS(Toss Design System)** 사용이 요구된다.
- 네이티브 풀포팅은 화면 재구현과 별도 빌드/심사가 필요하므로, WebView로 수요와 흐름을 검증한
  다음에 착수하는 것을 권장한다.
- 이 저장소의 현재 범위는 WebView 노출까지이며, Granite 포팅은 별도 작업으로 둔다.
