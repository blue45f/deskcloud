import type { surveyResponses, surveys } from '../db/schema'
import type { ResponseDto, SurveyDto } from '@surveydesk/shared'

type SurveyRow = typeof surveys.$inferSelect
type ResponseRow = typeof surveyResponses.$inferSelect

const iso = (d: Date | string): string =>
  d instanceof Date ? d.toISOString() : new Date(d).toISOString()

export function toSurveyDto(row: SurveyRow): SurveyDto {
  return {
    appId: row.appId,
    version: row.version,
    title: row.title,
    intro: row.intro ?? null,
    questions: row.questions,
    active: row.active,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

export function toResponseDto(row: ResponseRow): ResponseDto {
  return {
    id: row.id,
    appId: row.appId,
    surveyVersion: row.surveyVersion,
    answers: row.answers,
    respondentUserId: row.respondentUserId ?? null,
    respondentEmail: row.respondentEmail ?? null,
    meta: row.meta ?? null,
    createdAt: iso(row.createdAt),
  }
}
