# @reviewdesk/widget

외부 사이트에 임베드하는 **ReviewDesk 위젯** 4종. 모두 self-contained — `publishableKey`(pk_...)
와 `endpoint` props 만 주면 동작합니다. 의존성은 `react`(peer)뿐, 외부 CSS 프레임워크 0,
스코프 인라인 CSS(`.rd-*`)라 호스트 페이지와 충돌하지 않습니다.

| 컴포넌트 | 역할 | 백엔드 |
| --- | --- | --- |
| `<ReviewStars subjectId />` | 컴팩트 집계 배지(평균 별 + 건수) | `GET /api/reviews/aggregate` |
| `<ReviewList subjectId />` | 승인 리뷰 목록 + 분포 막대 + 집계 헤더 | `GET /api/reviews` |
| `<ReviewForm subjectId onSubmitted? />` | 리뷰 제출(별점 picker + 이름/제목/본문) | `POST /api/reviews` |
| `<TestimonialWall />` | featured/approved 후기 그리드 | `GET /api/reviews/wall` |

## 인증 (publishable 키)

위젯은 **publishable 키**(브라우저 안전 — 제출 + 승인본 읽기)만 씁니다. `x-pk` 헤더로 전송하며,
서버는 테넌트의 CORS Origin 허용목록을 함께 검사합니다. **secret 키(sk_...)는 위젯에 넣지 마세요**
(검수·CRUD 전용, 서버에서만 사용).

## React 사용

```tsx
import { ReviewStars, ReviewList, ReviewForm, TestimonialWall } from '@reviewdesk/widget'

const cfg = { publishableKey: 'pk_live_xxx', endpoint: 'https://reviews.example.com' }

// 1) 제품 제목 옆 배지
<ReviewStars {...cfg} subjectId="pro-plan" size="sm" href="#reviews" />

// 2) 리뷰 목록 + 분포 + 집계 헤더
<ReviewList {...cfg} subjectId="pro-plan" />

// 3) 리뷰 작성 폼 (별점 picker · 성공/감사/에러 상태)
<ReviewForm
  {...cfg}
  subjectId="pro-plan"
  subjectLabel="Pro 플랜"
  collectEmail
  onSubmitted={(r) => console.log(r.id, r.status)}
/>

// 4) 후기 월(featured/approved)
<TestimonialWall {...cfg} />
```

모든 위젯은 `accent`(강조색)·`accentInk`(accent 위 텍스트) 를 선택 props 로 받습니다.

## 바닐라(비-React) 임베드

빌드하면 `dist/reviewdesk-widget.js`(IIFE, react 인라인)가 생성됩니다. 비-React 페이지에서
플레이스홀더 `div` 에 `data-reviewdesk` 속성으로 위젯을 선언하고 `init` 한 번만 호출하세요:

```html
<div data-reviewdesk="stars" data-subject-id="pro-plan"></div>

<div data-reviewdesk="list" data-subject-id="pro-plan"></div>

<div data-reviewdesk="form" data-subject-id="pro-plan" data-subject-label="Pro 플랜"
     data-collect-email></div>

<div data-reviewdesk="wall" data-limit="9"></div>

<script src="https://reviews.example.com/reviewdesk-widget.js"></script>
<script>
  ReviewDesk.init({
    publishableKey: 'pk_live_xxx',
    endpoint: 'https://reviews.example.com',
    accent: '#2f5fe0',
  })
</script>
```

지원 data-* 속성: `data-reviewdesk`(stars|list|form|wall, 필수) · `data-subject-id` ·
`data-subject-label` · `data-limit` · `data-accent` · `data-title` · `data-subtitle` ·
`data-collect-email` · `data-hide-count` · `data-hide-distribution` · `data-href`.

명령형도 가능합니다:

```html
<script>
  const h = ReviewDesk.stars('#my-badge', {
    publishableKey: 'pk_live_xxx',
    endpoint: 'https://reviews.example.com',
    subjectId: 'pro-plan',
  })
  // h.unmount()
</script>
```

## 접근성

- `:focus-visible` 만 또렷한 포커스 링(마우스 클릭엔 없음)
- 별점 picker 는 roving radiogroup(←/→/↑/↓·Home·End)
- `prefers-reduced-motion` 존중(전환/애니메이션 즉시화)
- 본문 대비 ≥ 4.5:1, 별 채움색은 accent 와 독립이라 어떤 테마에서도 보임
- 상태 변화는 `role="status"`/`role="alert"` 로 알림, 별점 표시는 `aria-label` 로 의미 전달

## 개발

```bash
pnpm --filter @reviewdesk/widget run dev          # tsup watch (라이브러리)
pnpm --filter @reviewdesk/widget run dev:demo     # vite 데모 (http://127.0.0.1:5288)
pnpm --filter @reviewdesk/widget run typecheck
pnpm --filter @reviewdesk/widget run test
pnpm --filter @reviewdesk/widget run build        # tsup(ESM/CJS/d.ts) + vite(IIFE)
```

## 단일 파일 벤더 카피

워크스페이스 의존 없이 복붙해 쓰는 단일 파일 버전은 `apps-vendor/ReviewWidgets.tsx`(React)
와 동작/디자인이 동일합니다. npm publish 가 막힌 동안 형제 앱이 그대로 가져다 씁니다.
