import { boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

import type { ResponseMeta, SurveyQuestion } from '@surveydesk/shared'

/**
 * 설문 구성 — 앱(appId)별 버전드 설문. `(appId, version)` 유니크.
 * 활성본은 appId당 1개(active=true) — 서비스가 활성 전환 시 기존 활성본을 내린다.
 */
export const surveys = pgTable(
  'surveys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appId: text('app_id').notNull(),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    intro: text('intro'),
    /** 질문 배열(jsonb) — 타입은 @surveydesk/shared 의 SurveyQuestion[]. */
    questions: jsonb('questions').$type<SurveyQuestion[]>().notNull(),
    active: boolean('active').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('surveys_app_version_uq').on(t.appId, t.version),
    index('idx_surveys_app_active').on(t.appId, t.active),
  ]
)

/**
 * 설문 응답 — append-only. answers 는 qid→value 맵(jsonb).
 * respondent(userId/email)는 귀속 응답일 때만 채워지며, meta 는 위젯 컨텍스트.
 */
export const surveyResponses = pgTable(
  'survey_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appId: text('app_id').notNull(),
    surveyVersion: integer('survey_version').notNull(),
    answers: jsonb('answers').$type<Record<string, unknown>>().notNull(),
    respondentUserId: text('respondent_user_id'),
    respondentEmail: text('respondent_email'),
    meta: jsonb('meta').$type<ResponseMeta>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_responses_app_created').on(t.appId, t.createdAt),
    index('idx_responses_app_version').on(t.appId, t.surveyVersion),
  ]
)
