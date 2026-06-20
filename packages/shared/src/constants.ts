/** 질문 타입 — 위젯 렌더링·응답 검증·집계의 기준. */
export const QUESTION_TYPES = [
  'rating', // 별점 1–5 (정수)
  'nps', // 0–10 (정수) — 추천 의향
  'single_choice', // 보기 중 하나 (options 필수)
  'multi_choice', // 보기 중 여럿 (options 필수)
  'text', // 자유서술 (short/long)
] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

/** text 질문의 길이 변형 — UI 힌트(short=한 줄, long=여러 줄). 검증 한도에도 사용. */
export const TEXT_VARIANTS = ['short', 'long'] as const
export type TextVariant = (typeof TEXT_VARIANTS)[number]

/** rating 척도 경계(고정 1–5). */
export const RATING_MIN = 1
export const RATING_MAX = 5

/** NPS 척도 경계(고정 0–10). */
export const NPS_MIN = 0
export const NPS_MAX = 10

/** NPS 분류 경계 — 0–6 비추천(detractor), 7–8 중립(passive), 9–10 추천(promoter). */
export const NPS_DETRACTOR_MAX = 6
export const NPS_PROMOTER_MIN = 9

/** text 응답 최대 길이(변형별). */
export const TEXT_MAX = { short: 280, long: 4000 } as const

/** appId — 형제 앱 식별자. 소문자/숫자/하이픈, 1~64자. */
export const APP_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
