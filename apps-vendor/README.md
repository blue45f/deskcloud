# apps-vendor — 단일 파일 벤더 카피

npm publish 가 막힌 동안 외부 사이트/형제 앱에 **복붙해서 쓰는** 위젯 사본입니다.
워크스페이스 의존(`@reviewdesk/shared`) 0 — 필요한 상수·집계·검증을 파일에 인라인했습니다.
동작/디자인은 `packages/widget` 의 컴포넌트와 동일합니다.

## React 사이트 — `ReviewWidgets.tsx`

파일 하나를 프로젝트에 복사한 뒤 import 합니다. 의존성은 `react`(≥18)뿐입니다.

```tsx
import { ReviewStars, ReviewList, ReviewForm, TestimonialWall } from './ReviewWidgets'

const cfg = { publishableKey: 'pk_live_xxx', endpoint: 'https://reviews.example.com' }

function ProductPage() {
  return (
    <>
      <h1>Pro 플랜 <ReviewStars {...cfg} subjectId="pro-plan" href="#reviews" /></h1>

      <TestimonialWall {...cfg} limit={9} />

      <section id="reviews">
        <ReviewList {...cfg} subjectId="pro-plan" />
        <ReviewForm {...cfg} subjectId="pro-plan" subjectLabel="Pro 플랜" collectEmail />
      </section>
    </>
  )
}
```

네 컴포넌트 모두 `publishableKey` + `endpoint` props 만 필수입니다. `accent`/`accentInk` 로
강조색을 바꿀 수 있습니다.

## 비-React 사이트 — `<script>` IIFE

`packages/widget` 빌드 산출물 `dist/reviewdesk-widget.js`(react 인라인)를 호스팅한 뒤,
플레이스홀더 `div` 에 `data-reviewdesk` 속성으로 위젯을 선언하고 `init` 합니다:

```html
<div data-reviewdesk="stars" data-subject-id="pro-plan"></div>
<div data-reviewdesk="wall" data-limit="9"></div>
<div data-reviewdesk="list" data-subject-id="pro-plan"></div>
<div data-reviewdesk="form" data-subject-id="pro-plan" data-subject-label="Pro 플랜" data-collect-email></div>

<script src="https://reviews.example.com/reviewdesk-widget.js"></script>
<script>
  ReviewDesk.init({
    publishableKey: 'pk_live_xxx',
    endpoint: 'https://reviews.example.com',
    accent: '#2f5fe0',
  })
</script>
```

`vanilla-embed.html` 에 동작하는 예시가 있습니다(빌드 후 `packages/widget/dist/reviewdesk-widget.js`
경로를 맞춰 열면 됩니다).

## 인증·안전

- **publishable 키(pk_...)** 만 위젯에 넣습니다. 브라우저 노출 안전(제출 + 승인본 읽기).
- **secret 키(sk_...)** 는 절대 넣지 마세요. 검수·CRUD 전용으로 서버에서만 사용합니다.
- 서버는 테넌트의 CORS Origin 허용목록을 함께 검사하므로, 위젯을 띄울 도메인을 테넌트
  설정의 `corsOrigins` 에 등록해야 합니다.
