# @surveydesk/widget

형제 앱에 임베드하는 SurveyDesk **피드백 위젯**. 우하단(기본)에 떠 있는 "피드백" 버튼을
누르면 접근성 다이얼로그가 열리고, 활성 설문을 불러와 별점·NPS·객관식·자유서술을
수집해 제출합니다. 의존성은 `react`(peer)뿐, 외부 CSS 프레임워크 0.

## 백엔드 계약 (공개·무인증)

- `GET  {endpoint}/api/surveys/{appId}/active` → `SurveyDto` (활성본 없으면 404)
- `POST {endpoint}/api/surveys/{appId}/responses` → `{ id, surveyVersion, ... }`

## React 사용

```tsx
import { FeedbackWidget } from '@surveydesk/widget'

<FeedbackWidget
  appId="offhours"
  endpoint="https://surveys.example.com"
  accent="#2f5fe0"          // 선택 — 강조색
  position="bottom-right"    // 선택 — bottom-right | bottom-left | top-right | top-left
  apiToken={token}          // 선택 — 게이트웨이가 토큰을 요구할 때만
  onSubmitted={(r) => console.log(r.id)}
/>
```

활성 설문이 없으면 launcher 버튼 자체가 렌더되지 않습니다(조용히 숨김).

## 바닐라(비-React) 임베드

빌드하면 `dist/feedback-widget.js`(IIFE, react 인라인)가 생성됩니다. 비-React 페이지에서:

```html
<script src="https://surveys.example.com/feedback-widget.js"></script>
<script>
  SurveyDesk.init({ appId: 'offhours', endpoint: 'https://surveys.example.com' })
</script>
```

또는 명령형으로:

```js
const handle = SurveyDesk.mount({ appId, endpoint, accent: '#e0562f', position: 'bottom-left' })
// 나중에: handle.unmount()
```

## 단일 파일 벤더 버전

npm publish 가 막힌 동안에는 `apps-vendor/FeedbackWidget.tsx` 를 형제 앱에 그대로 복붙해서
씁니다(워크스페이스 의존 0, react 만 필요). 동작/디자인 동일.

## 빌드 / 검증

```bash
pnpm --filter @surveydesk/widget run build       # tsup(ESM/CJS/d.ts) + vite IIFE
pnpm --filter @surveydesk/widget run typecheck
pnpm --filter @surveydesk/widget run test
```

## 데모

```bash
pnpm --filter @surveydesk/api run start:dev       # 로컬 API (기본 :4090, PGlite)
pnpm --filter @surveydesk/widget run dev:demo     # 데모 (http://127.0.0.1:5188)
```

## 접근성 · 디자인

- `role="dialog"` + `aria-modal`, 포커스 트랩, Escape 닫기, launcher 로 포커스 복귀
- 별점은 `radiogroup`(화살표 이동), NPS 는 토글 버튼(`aria-pressed`), 에러는 `role="alert"`
- `:focus-visible` 만 링 표시, `prefers-reduced-motion` 존중, 본문 대비 ≥ 4.5:1
- 그라디언트 텍스트/기본 글래스모피즘/사이드-스트라이프 보더 없음, 시맨틱 z-index
