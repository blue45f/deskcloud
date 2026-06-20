/** 별점 척도 경계(고정 1–5 정수). */
export const RATING_MIN = 1
export const RATING_MAX = 5

/** 리뷰 검수 상태 — pending(대기) → approved(승인) | rejected(거절). */
export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

/** 검수 액션 — 어드민 PATCH 의 action 필드. */
export const MODERATION_ACTIONS = ['approve', 'reject', 'feature', 'unfeature', 'reply'] as const
export type ModerationAction = (typeof MODERATION_ACTIONS)[number]

/** 요금제 — free 는 소프트 한도가 적용된다. */
export const PLANS = ['free', 'pro', 'scale'] as const
export type Plan = (typeof PLANS)[number]

/** 무료 플랜 기본 소프트 한도(누적 제출). 초과 시 제출 402. env(FREE_PLAN_LIMIT)로 덮어쓸 수 있음. */
export const FREE_PLAN_LIMIT = 500

/** subjectId — 리뷰 대상(product/page/entity) 식별자. 소문자·숫자·하이픈, 1~128자. */
export const SUBJECT_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 테넌트 slug — 소문자·숫자·하이픈, 1~64자. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 발급 키 접두사 — publishable(브라우저 안전) / secret(서버 전용). */
export const PUBLISHABLE_KEY_PREFIX = 'pk_'
export const SECRET_KEY_PREFIX = 'sk_'

/** 본문/제목/이름 길이 한도. */
export const REVIEW_BODY_MAX = 4000
export const REVIEW_TITLE_MAX = 200
export const REVIEW_AUTHOR_MAX = 120
export const REVIEW_REPLY_MAX = 2000
