import { z } from 'zod'

import {
  APP_ID_RE,
  NPS_MAX,
  NPS_MIN,
  QUESTION_TYPES,
  RATING_MAX,
  RATING_MIN,
  TEXT_VARIANTS,
} from './constants'

/** appId — 형제 앱 식별자(소문자·숫자·하이픈). URL·테넌트 키로 쓰입니다. */
export const appIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(APP_ID_RE, 'appId는 소문자·숫자·하이픈만 가능합니다')

/** 질문 id — answers 맵의 키. 보수적으로 영숫자·언더스코어·하이픈만 허용. */
export const questionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, '질문 id는 영숫자·_·- 만 가능합니다')

/** 선택지(single/multi_choice) — value 는 answers 에 저장되는 안정적 키. */
export const optionSchema = z.object({
  value: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(200),
})
export type SurveyOption = z.infer<typeof optionSchema>

/**
 * 단일 질문 정의. choice 류는 options 1개 이상 필수, text 류는 variant 가 의미를 가짐.
 * 그 외 타입에서 options/variant 가 와도 무시(검증 시 superRefine 으로 일관성만 강제).
 */
export const questionSchema = z
  .object({
    id: questionIdSchema,
    type: z.enum(QUESTION_TYPES),
    label: z.string().trim().min(1).max(300),
    required: z.boolean().default(false),
    /** text 질문의 길이 변형(short/long). 미지정 시 short 로 간주. */
    variant: z.enum(TEXT_VARIANTS).optional(),
    /** single_choice·multi_choice 의 보기 목록. */
    options: z.array(optionSchema).max(50).optional(),
  })
  .superRefine((q, ctx) => {
    if (q.type === 'single_choice' || q.type === 'multi_choice') {
      if (!q.options || q.options.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['options'],
          message: `${q.type} 질문에는 options 가 1개 이상 필요합니다`,
        })
      } else {
        const values = q.options.map((o) => o.value)
        if (new Set(values).size !== values.length) {
          ctx.addIssue({ code: 'custom', path: ['options'], message: 'option value 가 중복됩니다' })
        }
      }
    }
  })
export type SurveyQuestion = z.infer<typeof questionSchema>

/** 설문 본문(버전 무관) — 생성·수정 입력의 공통 형태. */
export const surveyBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    /** 위젯 상단 안내문(선택). */
    intro: z
      .union([z.string().trim().max(2000), z.literal(''), z.null()])
      .transform((v) => (v ? v : undefined))
      .optional(),
    questions: z.array(questionSchema).min(1, '질문이 1개 이상 필요합니다').max(50),
  })
  .superRefine((s, ctx) => {
    const ids = s.questions.map((q) => q.id)
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['questions'], message: '질문 id 가 중복됩니다' })
    }
  })
export type SurveyBodyInput = z.infer<typeof surveyBodySchema>

/** 어드민 설문 생성 입력 — 새 버전을 만든다(활성화 여부는 별도 토글). */
export const createSurveySchema = surveyBodySchema
export type CreateSurveyInput = SurveyBodyInput

/** 어드민 설문 수정 입력 — 동일 형태로 해당 버전을 갱신. */
export const updateSurveySchema = surveyBodySchema
export type UpdateSurveyInput = SurveyBodyInput

/** 응답 메타(전부 선택) — 위젯이 보내는 컨텍스트. */
export const responseMetaSchema = z
  .object({
    pageUrl: z.string().trim().max(2000).optional(),
    userAgent: z.string().trim().max(1000).optional(),
    referrer: z.string().trim().max(2000).optional(),
  })
  .partial()
export type ResponseMeta = z.infer<typeof responseMetaSchema>

/** answers 의 단일 값으로 허용되는 형태(상세 검증은 활성 설문 기준으로 동적 수행). */
export const answerValueSchema = z.union([
  z.number(),
  z.string(),
  z.array(z.string()),
  z.boolean(),
])
export type AnswerValue = z.infer<typeof answerValueSchema>

/**
 * 공개 응답 제출의 1차(정적) 스키마 — 형태만 검증한다.
 * 질문별 타입/필수/범위 검증은 서버가 활성 설문을 불러와 `validateAnswers()` 로 2차 수행.
 */
export const submitResponseSchema = z.object({
  answers: z.record(questionIdSchema, answerValueSchema),
  /** 귀속 응답(선택) — 로그인 사용자라면 위젯이 채울 수 있음. */
  respondent: z
    .object({
      userId: z.string().trim().max(200).optional(),
      email: z.email().max(320).optional(),
    })
    .partial()
    .optional(),
  meta: responseMetaSchema.optional(),
})
export type SubmitResponseInput = z.infer<typeof submitResponseSchema>

/** rating 단일 값 검증(정수 1–5). */
export const ratingValueSchema = z.number().int().min(RATING_MIN).max(RATING_MAX)
/** nps 단일 값 검증(정수 0–10). */
export const npsValueSchema = z.number().int().min(NPS_MIN).max(NPS_MAX)
