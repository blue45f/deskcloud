/**
 * @reviewdesk/widget — 임베드 평점·리뷰·후기 위젯.
 *
 * - React 소비자: `import { ReviewStars, ReviewList, ReviewForm, TestimonialWall } from '@reviewdesk/widget'`
 * - 클라이언트만 필요: `import { createReviewDeskClient } from '@reviewdesk/widget'`
 * - 바닐라(비-React) 사이트: `@reviewdesk/widget/vanilla` 또는 IIFE 빌드(window.ReviewDesk)
 *
 * 모든 위젯은 publishableKey(pk_...) + endpoint props 로 동작하며 self-contained 다.
 */
export {
  createReviewDeskClient,
  ReviewDeskError,
  type PublicReviewsDto,
  type ReviewAggregate,
  type ReviewDeskClient,
  type ReviewDeskClientOptions,
  type ReviewReceiptDto,
  type ReviewWallDto,
  type SubmitReviewInput,
} from './client'

export {
  ReviewStars,
  ReviewList,
  ReviewForm,
  TestimonialWall,
  ReviewSummary,
  ReviewItem,
  TestimonialCard,
  type CommonWidgetProps,
  type ReviewStarsProps,
  type ReviewListProps,
  type ReviewFormProps,
  type TestimonialWallProps,
} from './react'

export { Stars, Avatar, formatDate, type StarSize } from './parts'

export { WIDGET_CSS, DEFAULT_ACCENT, DEFAULT_ACCENT_INK, type WidgetTheme } from './styles'

export {
  init,
  stars,
  list,
  form,
  wall,
  type WidgetHandle,
  type InitOptions,
} from './vanilla'
